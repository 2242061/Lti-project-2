const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const routerConfig = {
  host: "192.168.1.1",
  username: "admin",
  password: "12"
};

app.get("/", (req, res) => {
  res.json({ message: "Backend do TL1 a funcionar!" });
});

app.get("/api/system-resource", async (req, res) => {
  try {
    const response = await axios.get(
      `http://${routerConfig.host}/rest/system/resource`,
      {
        auth: {
          username: routerConfig.username,
          password: routerConfig.password
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao comunicar com o MikroTik",
      details: error.message
    });
  }
});

app.get("/api/interfaces", async (req, res) => {
  try {
    const response = await axios.get(
      `http://${routerConfig.host}/rest/interface`,
      {
        auth: {
          username: routerConfig.username,
          password: routerConfig.password
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao listar interfaces",
      details: error.message
    });
  }
});

app.get("/api/interfaces/wireless", async (req, res) => {
  try {
    const response = await axios.get(
      `http://${routerConfig.host}/rest/interface`,
      {
        auth: {
          username: routerConfig.username,
          password: routerConfig.password
        }
      }
    );

    const wireless = response.data.filter((iface) => iface.type === "wlan");
    res.json(wireless);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao listar interfaces wireless",
      details: error.message
    });
  }
});

app.get("/api/bridges", async (req, res) => {
  try {
    const response = await axios.get(
      `http://${routerConfig.host}/rest/interface/bridge`,
      {
        auth: {
          username: routerConfig.username,
          password: routerConfig.password
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao listar bridges",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});