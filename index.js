import express from "express";
import axios from "axios";
import fs from "fs";

const app = express();
app.use(express.json());

// ================= CONFIGURAÇÕES =================
const OPENAI_KEY = process.env.OPENAI_KEY; // coloque no Render
const LINK_VENDA = "https://skprimedigi-jwmoqaeu.manus.space";
const PORT = process.env.PORT || 3000;

if (!OPENAI_KEY) {
  console.error("ERRO: OPENAI_KEY não configurada");
  process.exit(1);
}

// ================= BANCO DE DADOS SIMPLES =================
const DB_FILE = "./users.json";
let users = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE))
  : {};

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// ================= FUNÇÕES =================
const delay = ms => new Promise(r => setTimeout(r, ms));

async function humanDelay() {
  const time = Math.floor(Math.random() * 4000) + 3000;
  await delay(time);
}

function classify(msg = "") {
  const m = msg.toLowerCase();
  if (/(comprei|paguei|pix)/.test(m)) return "compra";
  if (/(vou pensar|depois|agora não)/.test(m)) return "saida";
  if (/(preço|valor|quanto)/.test(m)) return "interesse";
  if (/(funciona|golpe|confiável)/.test(m)) return "objecao";
  return "normal";
}

// ================= PROMPT =================
function buildPrompt(message) {
  return `
Você é um humano real conversando no WhatsApp ou Instagram.
Nunca diga que é IA.
Fale curto, simples e natural.

Produtos:
- Produto 1: de R$15 por R$5,99
- Produto 2: de R$25 por R$14,99

Objetivo:
Levar a pessoa para comprar.
Sempre conduza para SIM ou NÃO.
Use urgência e prova social.
Não escreva textos longos.

Mensagem do cliente:
"${message}"

Link de compra:
${LINK_VENDA}
`;
}

// ================= ROTA =================
app.post("/chat", async (req, res) => {
  try {
    const { userId = "anonimo", message = "" } = req.body || {};

    if (!message) {
      return res.json({ reply: "Pode me explicar melhor? 🙂" });
    }

    if (!users[userId]) {
      users[userId] = { status: "novo", lastLink: 0 };
    }

    await humanDelay();

    const tipo = classify(message);

    if (tipo === "compra") {
      users[userId].status = "comprou";
      saveDB();
      return res.json({
        reply: `Perfeito 🎉  
Qualquer coisa me chama.  
Aqui está o acesso completo:  
${LINK_VENDA}`
      });
    }

    if (tipo === "saida") {
      return res.json({
        reply: `Tranquilo 🙂  
Só aviso porque o desconto pode sair a qualquer momento.  
${LINK_VENDA}`
      });
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 200,
        messages: [
          { role: "system", content: buildPrompt(message) },
          { role: "user", content: message }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let reply = response.data.choices[0].message.content;

    if (Date.now() - users[userId].lastLink > 5 * 60 * 1000) {
      reply += `\n\nComeça por aqui 👇\n${LINK_VENDA}`;
      users[userId].lastLink = Date.now();
    }

    saveDB();
    res.json({ reply });
  } catch (err) {
    console.error("Erro:", err.message);
    res.json({
      reply: `Tive um probleminha agora 😅  
Mas o link direto é esse:  
${LINK_VENDA}`
    });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`Chatbot rodando na porta ${PORT}`);
});
