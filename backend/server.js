const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/*
  Namespaces protegidos:
  - PROTECTED_NAMESPACES: não podem ser eliminados como namespace
  - PROTECTED_RESOURCE_NAMESPACES: não permite apagar recursos internos
*/
const PROTECTED_NAMESPACES = [
  "default",
  "kube-system",
  "kube-public",
  "kube-node-lease",
  "ingress-nginx",
];

const PROTECTED_RESOURCE_NAMESPACES = [
  "kube-system",
  "kube-public",
  "kube-node-lease",
  "ingress-nginx",
];

function isSafeKubernetesName(name) {
  return (
    typeof name === "string" &&
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)
  );
}

function isSafeImageName(image) {
  return (
    typeof image === "string" &&
    /^[a-zA-Z0-9._/:@-]+$/.test(image)
  );
}

function isPositiveNumber(value) {
  return !isNaN(value) && Number(value) > 0;
}

function runKubectl(command, res) {
  console.log("A executar:", command);

  exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr || error.message);

      return res.status(500).json({
        error: stderr || error.message,
      });
    }

    if (!stdout.trim()) {
      return res.json({
        message: "Operação realizada com sucesso",
      });
    }

    try {
      return res.json(JSON.parse(stdout));
    } catch {
      return res.json({
        output: stdout,
      });
    }
  });
}

function blockProtectedNamespace(namespace, res) {
  if (PROTECTED_NAMESPACES.includes(namespace)) {
    res.status(400).json({
      error: `O namespace "${namespace}" é protegido e não pode ser eliminado.`,
    });

    return true;
  }

  return false;
}

function blockProtectedResourceNamespace(namespace, res) {
  if (PROTECTED_RESOURCE_NAMESPACES.includes(namespace)) {
    res.status(400).json({
      error: `Não é permitido alterar recursos do namespace interno "${namespace}".`,
    });

    return true;
  }

  return false;
}

app.get("/", (req, res) => {
  res.json({
    message: "Backend Kubernetes TL2 online",
  });
});

/* =========================
   NODES
========================= */

app.get("/api/nodes", (req, res) => {
  runKubectl("kubectl get nodes -o json", res);
});

/* =========================
   NAMESPACES
========================= */

app.get("/api/namespaces", (req, res) => {
  runKubectl("kubectl get namespaces -o json", res);
});

app.post("/api/namespaces", (req, res) => {
  const { name } = req.body;

  if (!isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do namespace inválido. Usa letras minúsculas, números e hífens.",
    });
  }

  if (PROTECTED_NAMESPACES.includes(name)) {
    return res.status(400).json({
      error: "Esse nome está reservado para namespaces internos do Kubernetes.",
    });
  }

  runKubectl(`kubectl create namespace ${name} -o json`, res);
});

app.delete("/api/namespaces/:name", (req, res) => {
  const { name } = req.params;

  if (!isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do namespace inválido.",
    });
  }

  if (blockProtectedNamespace(name, res)) {
    return;
  }

  runKubectl(`kubectl delete namespace ${name}`, res);
});

/* =========================
   PODS
========================= */

app.get("/api/pods", (req, res) => {
  runKubectl("kubectl get pods -A -o json", res);
});

app.post("/api/pods", (req, res) => {
  const {
    name,
    image = "nginx",
    namespace = "default",
    port,
  } = req.body;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({
      error: "Nome do pod ou namespace inválido.",
    });
  }

  if (!isSafeImageName(image)) {
    return res.status(400).json({
      error: "Imagem Docker inválida.",
    });
  }

  let command =
    `kubectl run ${name} ` +
    `--image=${image} ` +
    `-n ${namespace}`;

  if (port && isPositiveNumber(port)) {
    command += ` --port=${port}`;
  }

  command += " -o json";

  runKubectl(command, res);
});

app.delete("/api/pods/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do pod ou namespace inválido.",
    });
  }

  if (blockProtectedResourceNamespace(namespace, res)) {
    return;
  }

  runKubectl(`kubectl delete pod ${name} -n ${namespace}`, res);
});

/* LOGS DOS PODS */

app.get("/api/pods/:namespace/:name/logs", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do pod ou namespace inválido.",
    });
  }

  exec(`kubectl logs ${name} -n ${namespace}`, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: stderr || error.message,
      });
    }

    return res.json({
      logs: stdout || "Sem logs disponíveis.",
    });
  });
});

/* =========================
   DEPLOYMENTS
========================= */

app.get("/api/deployments", (req, res) => {
  runKubectl("kubectl get deployments -A -o json", res);
});

app.post("/api/deployments", (req, res) => {
  const {
    name,
    image = "nginx",
    namespace = "default",
    replicas = 1,
  } = req.body;

  if (!isSafeKubernetesName(name) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({
      error: "Nome do deployment ou namespace inválido.",
    });
  }

  if (!isSafeImageName(image)) {
    return res.status(400).json({
      error: "Imagem Docker inválida.",
    });
  }

  if (!isPositiveNumber(replicas)) {
    return res.status(400).json({
      error: "O número de réplicas tem de ser superior a 0.",
    });
  }

  const command =
    `kubectl create deployment ${name} ` +
    `--image=${image} ` +
    `-n ${namespace} -o json ` +
    `&& kubectl scale deployment ${name} ` +
    `--replicas=${replicas} -n ${namespace}`;

  runKubectl(command, res);
});

app.patch("/api/deployments/:namespace/:name/scale", (req, res) => {
  const { namespace, name } = req.params;
  const { replicas } = req.body;

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do deployment ou namespace inválido.",
    });
  }

  if (!isPositiveNumber(replicas)) {
    return res.status(400).json({
      error: "O número de réplicas tem de ser superior a 0.",
    });
  }

  runKubectl(
    `kubectl scale deployment ${name} --replicas=${replicas} -n ${namespace}`,
    res
  );
});

app.delete("/api/deployments/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do deployment ou namespace inválido.",
    });
  }

  if (blockProtectedResourceNamespace(namespace, res)) {
    return;
  }

  runKubectl(`kubectl delete deployment ${name} -n ${namespace}`, res);
});

/* =========================
   SERVICES
========================= */

app.get("/api/services", (req, res) => {
  runKubectl("kubectl get services -A -o json", res);
});

app.post("/api/services", (req, res) => {
  const {
    deploymentName,
    namespace = "default",
    port = 80,
    type = "NodePort",
  } = req.body;

  if (!isSafeKubernetesName(deploymentName) || !isSafeKubernetesName(namespace)) {
    return res.status(400).json({
      error: "Nome do deployment ou namespace inválido.",
    });
  }

  if (!isPositiveNumber(port)) {
    return res.status(400).json({
      error: "A porta tem de ser um número válido.",
    });
  }

  if (!["ClusterIP", "NodePort", "LoadBalancer"].includes(type)) {
    return res.status(400).json({
      error: "Tipo de service inválido.",
    });
  }

  runKubectl(
    `kubectl expose deployment ${deploymentName} ` +
      `-n ${namespace} ` +
      `--type=${type} ` +
      `--port=${port} -o json`,
    res
  );
});

app.delete("/api/services/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do service ou namespace inválido.",
    });
  }

  if (blockProtectedResourceNamespace(namespace, res)) {
    return;
  }

  runKubectl(`kubectl delete service ${name} -n ${namespace}`, res);
});

/* =========================
   INGRESS
========================= */

app.get("/api/ingresses", (req, res) => {
  runKubectl("kubectl get ingress -A -o json", res);
});

app.post("/api/ingresses", (req, res) => {
  const {
    name,
    namespace = "default",
    serviceName,
    host,
    port = 80,
  } = req.body;

  if (
    !isSafeKubernetesName(name) ||
    !isSafeKubernetesName(namespace) ||
    !isSafeKubernetesName(serviceName)
  ) {
    return res.status(400).json({
      error: "Nome do ingress, namespace ou service inválido.",
    });
  }

  if (!host || typeof host !== "string") {
    return res.status(400).json({
      error: "Host inválido.",
    });
  }

  if (!isPositiveNumber(port)) {
    return res.status(400).json({
      error: "Porta inválida.",
    });
  }

  const command =
    `kubectl create ingress ${name} ` +
    `--class=nginx ` +
    `--rule="${host}/*=${serviceName}:${port}" ` +
    `-n ${namespace}`;

  runKubectl(command, res);
});

app.delete("/api/ingresses/:namespace/:name", (req, res) => {
  const { namespace, name } = req.params;

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do ingress ou namespace inválido.",
    });
  }

  if (blockProtectedResourceNamespace(namespace, res)) {
    return;
  }

  runKubectl(`kubectl delete ingress ${name} -n ${namespace}`, res);
});

/* =========================
   RESOURCE DETAILS
========================= */

app.get("/api/resources/:type/:namespace/:name", (req, res) => {
  const { type, namespace, name } = req.params;

  const allowedTypes = [
    "pod",
    "deployment",
    "service",
    "ingress",
  ];

  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: "Tipo de recurso inválido.",
    });
  }

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do recurso ou namespace inválido.",
    });
  }

  runKubectl(`kubectl get ${type} ${name} -n ${namespace} -o json`, res);
});

/* =========================
   YAML EXPORT
========================= */

app.get("/api/resources/:type/:namespace/:name/yaml", (req, res) => {
  const { type, namespace, name } = req.params;

  const allowedTypes = [
    "pod",
    "deployment",
    "service",
    "ingress",
  ];

  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: "Tipo de recurso inválido.",
    });
  }

  if (!isSafeKubernetesName(namespace) || !isSafeKubernetesName(name)) {
    return res.status(400).json({
      error: "Nome do recurso ou namespace inválido.",
    });
  }

  exec(`kubectl get ${type} ${name} -n ${namespace} -o yaml`, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: stderr || error.message,
      });
    }

    return res.json({
      yaml: stdout,
    });
  });
});

/* =========================
   METRICS
========================= */

app.get("/api/metrics/nodes", (req, res) => {
  exec("kubectl top nodes --no-headers", { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      return res.json({
        metrics: [],
        warning: stderr || error.message,
      });
    }

    const metrics = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().split(/\s+/);

        return {
          name: parts[0],
          cpu: parts[1],
          cpuPercentage: parts[2],
          memory: parts[3],
          memoryPercentage: parts[4],
        };
      });

    return res.json({ metrics });
  });
});

app.get("/api/metrics/pods", (req, res) => {
  exec("kubectl top pods -A --no-headers", { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      return res.json({
        metrics: [],
        warning: stderr || error.message,
      });
    }

    const metrics = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().split(/\s+/);

        return {
          namespace: parts[0],
          name: parts[1],
          cpu: parts[2],
          memory: parts[3],
        };
      });

    return res.json({ metrics });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Kubernetes TL2 em http://localhost:${PORT}`);
});