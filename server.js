// ============================================================
//  server.js — Servidor de Chat com WebSockets
//  Stack: Node.js nativo + biblioteca "ws"
// ============================================================

const http = require("http");
const fs   = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

// -----------------------------------------------------------
// 1. Servidor HTTP — entrega os arquivos estáticos da pasta /public
// -----------------------------------------------------------
const httpServer = http.createServer((req, res) => {
  // Mapeia "/" para "/index.html"
  const filePath = req.url === "/"
    ? path.join(__dirname, "public", "index.html")
    : path.join(__dirname, "public", req.url);

  // Detecta o Content-Type pelo extension
  const ext = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html",
    ".css":  "text/css",
    ".js":   "text/javascript",
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Arquivo não encontrado");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });
    res.end(data);
  });
});

// -----------------------------------------------------------
// 2. Servidor WebSocket — montado sobre o mesmo servidor HTTP
// -----------------------------------------------------------
const wss = new WebSocketServer({ server: httpServer });

// Mapa: socket → { username, color }
const clientes = new Map();

// Paleta de cores para os nicknames (estilo mIRC)
const CORES = [
  "#ff6b6b", "#ffd93d", "#6bcb77", "#4ecdc4",
  "#a8dadc", "#f4a261", "#e76f51", "#c77dff",
  "#74b9ff", "#fd79a8",
];

let indiceCor = 0;
function proximaCor() {
  const cor = CORES[indiceCor % CORES.length];
  indiceCor++;
  return cor;
}

// -----------------------------------------------------------
// 3. Funções auxiliares para envio de mensagens
// -----------------------------------------------------------

//enviar json para um único cliente 
function enviar(socket, objeto) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(objeto));//envia para o cliente na funcao enviar
  }
  
}
//enviar json para todos os clientes conectados, exceto o remetente (se fornecido)
function broadcast(objeto, remetente = null) {
  for (const [socket] of clientes) {
    if (socket !== remetente) {
      enviar(socket, objeto);
    }
  }
}

function listaUsuarios() {
  return [...clientes.values()].map(c => (
    { 
      username: c.username,
      color: c.color })
    );

}

// -----------------------------------------------------------
// 4. Eventos WebSocket
// -----------------------------------------------------------
wss.on("connection", (socket) => {
  //4.1 recebe mensagem do cliente
  console.log("Novo cliente conectado");
  socket.on("message", (msg) => {
    let data
    try{
      data = JSON.parse(msg);
    }catch(e){
      return;
    }
    //tipo entrar
    if(data.tipo === "mensagem"){
      const cliente = clientes.get(socket);
      if(!cliente) return;
      const texto = String(data.texto).trim().slice(0, 200);
      if(!texto) return;
      broadcast({
        hora: new Date().toLocaleTimeString('pt-BR', { hour: "2-digit", minute: "2-digit" }),
        tipo: "mensagem",
        username: cliente.username,
        color: cliente.color,
        texto: texto
      });
      
    }

    // console.log("Mensagem recebida do cliente:", data);
    if(data.tipo === "entrar"){
      const username = String(data.username).trim().slice(0, 20);
      // @TODO validar username (não vazio, não duplicado)
      const color = proximaCor();
      clientes.set(socket, { username, color });

      // envia a lista de usuários para o novo cliente
      enviar(socket, { tipo: "confirmacao", usuario: username, color: color});
      broadcast({
        tipo: "sistema",
        texto: `${username} entrou no chat`,
        usuarios: listaUsuarios()
      });
    }

    socket.on("close", () => {
      const cliente = clientes.get(socket);
      if(!cliente) return;
      if(cliente){
        clientes.delete(socket);
        broadcast({
          tipo: "sistema",
          texto: `${cliente.username} saiu do chat`,
          usuarios: listaUsuarios()
        });
      }
    });
    
  })
});


// -----------------------------------------------------------
// 5. Inicia o servidor
// -----------------------------------------------------------
const PORTA = process.env.PORT || 3000;
httpServer.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});
