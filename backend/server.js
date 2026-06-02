const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

function isSafeKubernetesName(name) {
  return typeof name === "string" && /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name);
}

function runKubectl(command, res) {
  exec(command, { timeout: 20000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: stderr || error.message,
      });
    }

    if (!stdout.trim()) {
      return res.json({ message: "Operação realizada com sucesso" });
    }

    try {
      return res.json(JSON.parse(stdout));
    } catch {
      return res.json({ output: stdout });
    }
  });
}

app.get("/", (req, res) => {
  res.json({ message: "Backend TL2 Kubernetes a funcionar" });
});

app.get("/api/nodes", (req, res) => {
  runKubectl("kubectl get nodes -o json", res);
});

app.get("/api/namespaces", (req, res) => {
  runKubectl("kubectl get namespaces -o json", res);
});

app.post("/api/namespaces", (req, res) => {
  const { name } = req.body;

  if (!isSafeKubernetesName(name)) {
    return res.status(400).json({ error: "Nome de namespace inválido" });
  }

  runKubectl(`kubectl create namespace ${name} -o json`, res);
});

app.delete("/api/namespaces/:name", (req, res) => {
  const { name } = req.params;

  if (!isSafeKubernetesName(name)) {
    return res.status(400).json({ error: "Nome de namespace inválido" });
  }

  runKubectl(`kubectl delete namespace ${name}`, res);
});

app.get("/api/pods", (req, res) => {
  runKubectl("kubectl get pods -A -o json", res);
});

app.post("/api/pods", (req, res) => {
  const { name, image = "nginx", namespace = "default" } = req.body;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({ error: "Nome do pod ou namespace inválido" });
  }

  runKubectl(`kubectl run ${name} --image=${image} -n ${namespace} -o json`, res);
});

app.delete("/api/pods/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({ error: "Nome do pod ou namespace inválido" });
  }

  runKubectl(`kubectl delete pod ${name} -n ${namespace}`, res);
});

app.get("/api/deployments", (req, res) => {
  runKubectl("kubectl get deployments -A -o json", res);
});

app.post("/api/deployments", (req, res) => {
  const { name, image = "nginx", namespace = "default" } = req.body;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({ error: "Nome do deployment ou namespace inválido" });
  }

  runKubectl(`kubectl create deployment ${name} --image=${image} -n ${namespace} -o json`, res);
});

app.delete("/api/deployments/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({ error: "Nome do deployment ou namespace inválido" });
  }

  runKubectl(`kubectl delete deployment ${name} -n ${namespace}`, res);
});

app.get("/api/services", (req, res) => {
  runKubectl("kubectl get services -A -o json", res);
});

app.post("/api/services", (req, res) => {
  const { deploymentName, namespace = "default", port = 80, type = "NodePort" } = req.body;

  if (!isSafeKubernetesName(deploymentName) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({ error: "Nome do deployment ou namespace inválido" });
  }

  runKubectl(
    `kubectl expose deployment ${deploymentName} -n ${namespace} --type=${type} --port=${port} -o json`,
    res
  );
});

app.delete("/api/services/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({ error: "Nome do service ou namespace inválido" });
  }

  runKubectl(`kubectl delete service ${name} -n ${namespace}`, res);
});

app.get("/api/ingresses", (req, res) => {
  runKubectl("kubectl get ingress -A -o json", res);
});

app.delete("/api/ingresses/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({ error: "Nome do ingress ou namespace inválido" });
  }

  runKubectl(`kubectl delete ingress ${name} -n ${namespace}`, res);
});

app.listen(PORT, () => {
  console.log(`Servidor TL2 Kubernetes a correr em http://localhost:${PORT}`);
});