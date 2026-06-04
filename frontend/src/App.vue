<script setup>
import { computed, onMounted, ref } from "vue";

const API_URL = "http://localhost:3000/api";

const activePage = ref("dashboard");
const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const nodes = ref([]);
const namespaces = ref([]);
const pods = ref([]);
const deployments = ref([]);
const services = ref([]);
const ingresses = ref([]);

const namespaceForm = ref({
  name: "",
});

const podForm = ref({
  name: "",
  image: "nginx",
  namespace: "default",
  port: 80,
});

const deploymentForm = ref({
  name: "",
  image: "nginx",
  namespace: "default",
  replicas: 1,
});

const serviceForm = ref({
  deploymentName: "",
  namespace: "default",
  port: 80,
  type: "NodePort",
});

const ingressForm = ref({
  name: "",
  namespace: "default",
  serviceName: "",
  host: "nginx.local",
  port: 80,
});

const scaleForm = ref({
  namespace: "",
  name: "",
  replicas: 1,
});

const selectedNamespaceFilter = ref("all");
const selectedResourceDetails = ref(null);

const pages = [
  { id: "dashboard", label: "Dashboard" },
  { id: "nodes", label: "Nodes" },
  { id: "namespaces", label: "Namespaces" },
  { id: "pods", label: "Pods" },
  { id: "deployments", label: "Deployments" },
  { id: "services", label: "Services" },
  { id: "ingresses", label: "Ingress" },
];

const protectedNamespaces = [
  "default",
  "kube-system",
  "kube-public",
  "kube-node-lease",
  "ingress-nginx",
];

function showError(message) {
  errorMessage.value = message;
  successMessage.value = "";
}

function showSuccess(message) {
  successMessage.value = message;
  errorMessage.value = "";
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erro ao comunicar com o backend");
  }

  return data;
}

async function loadAll() {
  loading.value = true;
  errorMessage.value = "";

  try {
    await Promise.all([
      loadNodes(),
      loadNamespaces(),
      loadPods(),
      loadDeployments(),
      loadServices(),
      loadIngresses(),
    ]);
  } catch (error) {
    showError(error.message);
  } finally {
    loading.value = false;
  }
}

async function loadNodes() {
  const data = await request("/nodes");
  nodes.value = data.items || [];
}

async function loadNamespaces() {
  const data = await request("/namespaces");
  namespaces.value = data.items || [];
}

async function loadPods() {
  const data = await request("/pods");
  pods.value = data.items || [];
}

async function loadDeployments() {
  const data = await request("/deployments");
  deployments.value = data.items || [];
}

async function loadServices() {
  const data = await request("/services");
  services.value = data.items || [];
}

async function loadIngresses() {
  const data = await request("/ingresses");
  ingresses.value = data.items || [];
}

function isProtectedNamespace(namespace) {
  return protectedNamespaces.includes(namespace);
}

async function createNamespace() {
  if (!namespaceForm.value.name) {
    showError("Escreve o nome do namespace.");
    return;
  }

  try {
    await request("/namespaces", {
      method: "POST",
      body: JSON.stringify(namespaceForm.value),
    });

    showSuccess("Namespace criado com sucesso.");
    namespaceForm.value.name = "";
    await loadNamespaces();
  } catch (error) {
    showError(error.message);
  }
}

async function deleteNamespace(name) {
  if (isProtectedNamespace(name)) {
    showError("Não deves eliminar namespaces internos do Kubernetes.");
    return;
  }

  if (!confirm(`Tens a certeza que queres eliminar o namespace "${name}"?`)) {
    return;
  }

  try {
    await request(`/namespaces/${name}`, {
      method: "DELETE",
    });

    showSuccess("Namespace eliminado com sucesso.");
    await loadAll();
  } catch (error) {
    showError(error.message);
  }
}

async function createPod() {
  if (!podForm.value.name || !podForm.value.image || !podForm.value.namespace) {
    showError("Preenche o nome, imagem e namespace do pod.");
    return;
  }

  try {
    await request("/pods", {
      method: "POST",
      body: JSON.stringify(podForm.value),
    });

    showSuccess("Pod criado com sucesso.");
    podForm.value.name = "";
    podForm.value.image = "nginx";
    podForm.value.port = 80;
    await loadPods();
  } catch (error) {
    showError(error.message);
  }
}

async function deletePod(namespace, name) {
  if (!confirm(`Eliminar pod "${name}" no namespace "${namespace}"?`)) {
    return;
  }

  try {
    await request(`/pods/${namespace}/${name}`, {
      method: "DELETE",
    });

    showSuccess("Pod eliminado com sucesso.");
    await loadPods();
  } catch (error) {
    showError(error.message);
  }
}

async function createDeployment() {
  if (
    !deploymentForm.value.name ||
    !deploymentForm.value.image ||
    !deploymentForm.value.namespace ||
    !deploymentForm.value.replicas
  ) {
    showError("Preenche o nome, imagem, namespace e número de réplicas.");
    return;
  }

  try {
    await request("/deployments", {
      method: "POST",
      body: JSON.stringify(deploymentForm.value),
    });

    showSuccess("Deployment criado com sucesso.");
    deploymentForm.value.name = "";
    deploymentForm.value.image = "nginx";
    deploymentForm.value.replicas = 1;

    await loadDeployments();
    await loadPods();
  } catch (error) {
    showError(error.message);
  }
}

async function deleteDeployment(namespace, name) {
  if (isProtectedNamespace(namespace)) {
    showError("Não deves eliminar deployments de namespaces internos do Kubernetes.");
    return;
  }

  if (!confirm(`Eliminar deployment "${name}" no namespace "${namespace}"?`)) {
    return;
  }

  try {
    await request(`/deployments/${namespace}/${name}`, {
      method: "DELETE",
    });

    showSuccess("Deployment eliminado com sucesso.");
    await loadDeployments();
    await loadPods();
  } catch (error) {
    showError(error.message);
  }
}

function openScaleDeployment(namespace, name, currentReplicas) {
  scaleForm.value.namespace = namespace;
  scaleForm.value.name = name;
  scaleForm.value.replicas = currentReplicas || 1;
}

async function scaleDeployment() {
  if (!scaleForm.value.namespace || !scaleForm.value.name || !scaleForm.value.replicas) {
    showError("Escolhe um deployment e indica o número de réplicas.");
    return;
  }

  try {
    await request(
      `/deployments/${scaleForm.value.namespace}/${scaleForm.value.name}/scale`,
      {
        method: "PATCH",
        body: JSON.stringify({
          replicas: scaleForm.value.replicas,
        }),
      }
    );

    showSuccess("Deployment escalado com sucesso.");
    scaleForm.value.namespace = "";
    scaleForm.value.name = "";
    scaleForm.value.replicas = 1;

    await loadDeployments();
    await loadPods();
  } catch (error) {
    showError(error.message);
  }
}

async function createService() {
  if (!serviceForm.value.deploymentName || !serviceForm.value.namespace || !serviceForm.value.port) {
    showError("Preenche o deployment, namespace e porta.");
    return;
  }

  try {
    await request("/services", {
      method: "POST",
      body: JSON.stringify(serviceForm.value),
    });

    showSuccess("Service criado com sucesso.");
    serviceForm.value.deploymentName = "";
    serviceForm.value.port = 80;
    await loadServices();
  } catch (error) {
    showError(error.message);
  }
}

async function deleteService(namespace, name) {
  if (isProtectedNamespace(namespace)) {
    showError("Não deves eliminar services de namespaces internos do Kubernetes.");
    return;
  }

  if (!confirm(`Eliminar service "${name}" no namespace "${namespace}"?`)) {
    return;
  }

  try {
    await request(`/services/${namespace}/${name}`, {
      method: "DELETE",
    });

    showSuccess("Service eliminado com sucesso.");
    await loadServices();
  } catch (error) {
    showError(error.message);
  }
}

async function createIngress() {
  if (
    !ingressForm.value.name ||
    !ingressForm.value.namespace ||
    !ingressForm.value.serviceName ||
    !ingressForm.value.host ||
    !ingressForm.value.port
  ) {
    showError("Preenche o nome, namespace, service, host e porta do ingress.");
    return;
  }

  try {
    await request("/ingresses", {
      method: "POST",
      body: JSON.stringify(ingressForm.value),
    });

    showSuccess("Ingress criado com sucesso.");
    ingressForm.value.name = "";
    ingressForm.value.serviceName = "";
    ingressForm.value.host = "nginx.local";
    ingressForm.value.port = 80;
    await loadIngresses();
  } catch (error) {
    showError(error.message);
  }
}

async function deleteIngress(namespace, name) {
  if (isProtectedNamespace(namespace)) {
    showError("Não deves eliminar ingress de namespaces internos do Kubernetes.");
    return;
  }

  if (!confirm(`Eliminar ingress "${name}" no namespace "${namespace}"?`)) {
    return;
  }

  try {
    await request(`/ingresses/${namespace}/${name}`, {
      method: "DELETE",
    });

    showSuccess("Ingress eliminado com sucesso.");
    await loadIngresses();
  } catch (error) {
    showError(error.message);
  }
}

async function viewResourceDetails(type, namespace, name) {
  try {
    const data = await request(`/resources/${type}/${namespace}/${name}`);
    selectedResourceDetails.value = data;
  } catch (error) {
    showError(error.message);
  }
}

function closeResourceDetails() {
  selectedResourceDetails.value = null;
}

function getNodeStatus(node) {
  const readyCondition = node.status?.conditions?.find(
    (condition) => condition.type === "Ready"
  );

  return readyCondition?.status === "True" ? "Ready" : "NotReady";
}

function getPodStatus(pod) {
  return pod.status?.phase || "Desconhecido";
}

function getDeploymentReady(deployment) {
  const ready = deployment.status?.readyReplicas || 0;
  const total = deployment.status?.replicas || 0;
  return `${ready}/${total}`;
}

function getServicePorts(service) {
  return service.spec?.ports
    ?.map((port) => {
      if (port.nodePort) {
        return `${port.port}:${port.nodePort}/${port.protocol}`;
      }

      return `${port.port}/${port.protocol}`;
    })
    .join(", ");
}

const filteredPods = computed(() => {
  if (selectedNamespaceFilter.value === "all") {
    return pods.value;
  }

  return pods.value.filter(
    (pod) => pod.metadata.namespace === selectedNamespaceFilter.value
  );
});

const filteredDeployments = computed(() => {
  if (selectedNamespaceFilter.value === "all") {
    return deployments.value;
  }

  return deployments.value.filter(
    (deployment) => deployment.metadata.namespace === selectedNamespaceFilter.value
  );
});

const filteredServices = computed(() => {
  if (selectedNamespaceFilter.value === "all") {
    return services.value;
  }

  return services.value.filter(
    (service) => service.metadata.namespace === selectedNamespaceFilter.value
  );
});

const filteredIngresses = computed(() => {
  if (selectedNamespaceFilter.value === "all") {
    return ingresses.value;
  }

  return ingresses.value.filter(
    (ingress) => ingress.metadata.namespace === selectedNamespaceFilter.value
  );
});

const podsRunning = computed(() => {
  return pods.value.filter((pod) => pod.status?.phase === "Running").length;
});

const podsPending = computed(() => {
  return pods.value.filter((pod) => pod.status?.phase === "Pending").length;
});

const podsFailed = computed(() => {
  return pods.value.filter((pod) => pod.status?.phase === "Failed").length;
});

const nodesReady = computed(() => {
  return nodes.value.filter((node) => getNodeStatus(node) === "Ready").length;
});

const deploymentsReady = computed(() => {
  return deployments.value.filter((deployment) => {
    const ready = deployment.status?.readyReplicas || 0;
    const total = deployment.status?.replicas || 0;

    return total > 0 && ready === total;
  }).length;
});

const dashboardCards = computed(() => [
  { title: "Nodes Ready", value: `${nodesReady.value} / ${nodes.value.length}` },
  { title: "Namespaces", value: namespaces.value.length },
  { title: "Pods Running", value: podsRunning.value },
  { title: "Pods Pending", value: podsPending.value },
  { title: "Pods Failed", value: podsFailed.value },
  { title: "Deployments Ready", value: `${deploymentsReady.value} / ${deployments.value.length}` },
  { title: "Services", value: services.value.length },
  { title: "Ingress", value: ingresses.value.length },
]);

onMounted(() => {
  loadAll();
});
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="logo">
        <h1>TL2</h1>
        <p>Kubernetes Manager</p>
      </div>

      <nav>
        <button
          v-for="page in pages"
          :key="page.id"
          :class="{ active: activePage === page.id }"
          @click="activePage = page.id"
        >
          {{ page.label }}
        </button>
      </nav>
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <h2>Gestão do Orquestrador Kubernetes</h2>
          <p>Dashboard e gestão de recursos através da API do Kubernetes</p>
        </div>

        <button class="refresh-btn" @click="loadAll">
          Atualizar
        </button>
      </header>

      <div v-if="loading" class="message info">
        A carregar dados do cluster...
      </div>

      <div v-if="errorMessage" class="message error">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="message success">
        {{ successMessage }}
      </div>

      <!-- DASHBOARD -->
      <section v-if="activePage === 'dashboard'" class="section">
        <h3>Dashboard do Cluster</h3>

        <div class="cards">
          <div v-for="card in dashboardCards" :key="card.title" class="card">
            <span>{{ card.title }}</span>
            <strong>{{ card.value }}</strong>
          </div>
        </div>

        <div class="panel">
          <h4>Demonstração sugerida</h4>

          <ol>
            <li>Criar namespace <strong>demo</strong></li>
            <li>Criar deployment <strong>nginx-deployment</strong> com imagem <strong>nginx</strong></li>
            <li>Escalar deployment para <strong>3 réplicas</strong></li>
            <li>Criar service do tipo <strong>NodePort</strong></li>
            <li>Ver os pods criados automaticamente</li>
            <li>Eliminar service, deployment e namespace</li>
          </ol>
        </div>
      </section>

      <!-- NODES -->
      <section v-if="activePage === 'nodes'" class="section">
        <h3>Nodes</h3>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Estado</th>
              <th>Versão Kubernetes</th>
              <th>Sistema Operativo</th>
              <th>Container Runtime</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="node in nodes" :key="node.metadata.name">
              <td>{{ node.metadata.name }}</td>
              <td>
                <span
                  class="badge"
                  :class="getNodeStatus(node) === 'Ready' ? 'green' : 'red'"
                >
                  {{ getNodeStatus(node) }}
                </span>
              </td>
              <td>{{ node.status.nodeInfo.kubeletVersion }}</td>
              <td>{{ node.status.nodeInfo.osImage }}</td>
              <td>{{ node.status.nodeInfo.containerRuntimeVersion }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- NAMESPACES -->
      <section v-if="activePage === 'namespaces'" class="section">
        <h3>Namespaces</h3>

        <div class="form">
          <input
            v-model="namespaceForm.name"
            placeholder="Nome do namespace"
          />

          <button @click="createNamespace">
            Criar Namespace
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Estado</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="namespace in namespaces" :key="namespace.metadata.name">
              <td>{{ namespace.metadata.name }}</td>
              <td>{{ namespace.status.phase }}</td>
              <td>{{ namespace.metadata.creationTimestamp }}</td>
              <td>
                <button
                  class="delete-btn"
                  :disabled="isProtectedNamespace(namespace.metadata.name)"
                  @click="deleteNamespace(namespace.metadata.name)"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- PODS -->
      <section v-if="activePage === 'pods'" class="section">
        <h3>Pods</h3>

        <div class="form">
          <input
            v-model="podForm.name"
            placeholder="Nome do pod"
          />

          <input
            v-model="podForm.image"
            placeholder="Imagem Docker"
          />

          <input
            v-model="podForm.port"
            type="number"
            min="1"
            placeholder="Porta do container"
          />

          <select v-model="podForm.namespace">
            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>

          <button @click="createPod">
            Criar Pod
          </button>
        </div>

        <div class="filter">
          <label>Filtrar por namespace:</label>

          <select v-model="selectedNamespaceFilter">
            <option value="all">Todos</option>

            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Namespace</th>
              <th>Estado</th>
              <th>Node</th>
              <th>Imagem</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="pod in filteredPods" :key="`${pod.metadata.namespace}-${pod.metadata.name}`">
              <td>{{ pod.metadata.name }}</td>
              <td>{{ pod.metadata.namespace }}</td>
              <td>
                <span
                  class="badge"
                  :class="getPodStatus(pod) === 'Running' ? 'green' : getPodStatus(pod) === 'Failed' ? 'red' : 'orange'"
                >
                  {{ getPodStatus(pod) }}
                </span>
              </td>
              <td>{{ pod.spec.nodeName || "-" }}</td>
              <td>{{ pod.spec.containers?.[0]?.image }}</td>
              <td>
                <button
                  class="details-btn"
                  @click="viewResourceDetails('pod', pod.metadata.namespace, pod.metadata.name)"
                >
                  Detalhes
                </button>

                <button
  class="delete-btn"
  @click="deletePod(pod.metadata.namespace, pod.metadata.name)"
>
  Eliminar
</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- DEPLOYMENTS -->
      <section v-if="activePage === 'deployments'" class="section">
        <h3>Deployments</h3>

        <div class="form">
          <input
            v-model="deploymentForm.name"
            placeholder="Nome do deployment"
          />

          <input
            v-model="deploymentForm.image"
            placeholder="Imagem Docker"
          />

          <input
            v-model="deploymentForm.replicas"
            type="number"
            min="1"
            placeholder="Réplicas"
          />

          <select v-model="deploymentForm.namespace">
            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>

          <button @click="createDeployment">
            Criar Deployment
          </button>
        </div>

        <div class="filter">
          <label>Filtrar por namespace:</label>

          <select v-model="selectedNamespaceFilter">
            <option value="all">Todos</option>

            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Namespace</th>
              <th>Ready</th>
              <th>Replicas</th>
              <th>Imagem</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="deployment in filteredDeployments"
              :key="`${deployment.metadata.namespace}-${deployment.metadata.name}`"
            >
              <td>{{ deployment.metadata.name }}</td>
              <td>{{ deployment.metadata.namespace }}</td>
              <td>{{ getDeploymentReady(deployment) }}</td>
              <td>{{ deployment.status.replicas || 0 }}</td>
              <td>{{ deployment.spec.template.spec.containers?.[0]?.image }}</td>
              <td>
                <button
                  class="details-btn"
                  @click="viewResourceDetails('deployment', deployment.metadata.namespace, deployment.metadata.name)"
                >
                  Detalhes
                </button>

                <button
                  class="scale-btn"
                  @click="openScaleDeployment(
                    deployment.metadata.namespace,
                    deployment.metadata.name,
                    deployment.status.replicas || 1
                  )"
                >
                  Escalar
                </button>

                <button
                  class="delete-btn"
                  :disabled="isProtectedNamespace(deployment.metadata.namespace)"
                  @click="deleteDeployment(deployment.metadata.namespace, deployment.metadata.name)"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="scaleForm.name" class="panel scale-panel">
          <h4>Escalar Deployment</h4>

          <p>
            Deployment:
            <strong>{{ scaleForm.name }}</strong>
            no namespace
            <strong>{{ scaleForm.namespace }}</strong>
          </p>

          <div class="form">
            <input
              v-model="scaleForm.replicas"
              type="number"
              min="1"
              placeholder="Número de réplicas"
            />

            <button @click="scaleDeployment">
              Confirmar escala
            </button>

            <button class="cancel-btn" @click="scaleForm.name = ''">
              Cancelar
            </button>
          </div>
        </div>
      </section>

      <!-- SERVICES -->
      <section v-if="activePage === 'services'" class="section">
        <h3>Services</h3>

        <div class="form">
          <input
            v-model="serviceForm.deploymentName"
            placeholder="Nome do deployment"
          />

          <select v-model="serviceForm.namespace">
            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>

          <input
            v-model="serviceForm.port"
            type="number"
            min="1"
            placeholder="Porta"
          />

          <select v-model="serviceForm.type">
            <option value="ClusterIP">ClusterIP</option>
            <option value="NodePort">NodePort</option>
            <option value="LoadBalancer">LoadBalancer</option>
          </select>

          <button @click="createService">
            Criar Service
          </button>
        </div>

        <div class="filter">
          <label>Filtrar por namespace:</label>

          <select v-model="selectedNamespaceFilter">
            <option value="all">Todos</option>

            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Namespace</th>
              <th>Tipo</th>
              <th>Cluster IP</th>
              <th>Portas</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="service in filteredServices"
              :key="`${service.metadata.namespace}-${service.metadata.name}`"
            >
              <td>{{ service.metadata.name }}</td>
              <td>{{ service.metadata.namespace }}</td>
              <td>{{ service.spec.type }}</td>
              <td>{{ service.spec.clusterIP }}</td>
              <td>{{ getServicePorts(service) }}</td>
              <td>
                <button
                  class="details-btn"
                  @click="viewResourceDetails('service', service.metadata.namespace, service.metadata.name)"
                >
                  Detalhes
                </button>

                <button
                  class="delete-btn"
                  :disabled="isProtectedNamespace(service.metadata.namespace)"
                  @click="deleteService(service.metadata.namespace, service.metadata.name)"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- INGRESS -->
      <section v-if="activePage === 'ingresses'" class="section">
        <h3>Ingress</h3>

        <div class="panel">
          <p>
            Para criar Ingress no Kind, é necessário ter instalado o NGINX Ingress Controller.
          </p>
        </div>

        <div class="form">
          <input
            v-model="ingressForm.name"
            placeholder="Nome do ingress"
          />

          <select v-model="ingressForm.namespace">
            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>

          <input
            v-model="ingressForm.serviceName"
            placeholder="Nome do service"
          />

          <input
            v-model="ingressForm.host"
            placeholder="Host ex: nginx.local"
          />

          <input
            v-model="ingressForm.port"
            type="number"
            min="1"
            placeholder="Porta"
          />

          <button @click="createIngress">
            Criar Ingress
          </button>
        </div>

        <div class="filter">
          <label>Filtrar por namespace:</label>

          <select v-model="selectedNamespaceFilter">
            <option value="all">Todos</option>

            <option
              v-for="namespace in namespaces"
              :key="namespace.metadata.name"
              :value="namespace.metadata.name"
            >
              {{ namespace.metadata.name }}
            </option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Namespace</th>
              <th>Classe</th>
              <th>Hosts</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="ingress in filteredIngresses"
              :key="`${ingress.metadata.namespace}-${ingress.metadata.name}`"
            >
              <td>{{ ingress.metadata.name }}</td>
              <td>{{ ingress.metadata.namespace }}</td>
              <td>{{ ingress.spec.ingressClassName || "-" }}</td>
              <td>
                {{
                  ingress.spec.rules
                    ?.map((rule) => rule.host || "-")
                    .join(", ")
                }}
              </td>
              <td>
                <button
                  class="details-btn"
                  @click="viewResourceDetails('ingress', ingress.metadata.namespace, ingress.metadata.name)"
                >
                  Detalhes
                </button>

                <button
                  class="delete-btn"
                  :disabled="isProtectedNamespace(ingress.metadata.namespace)"
                  @click="deleteIngress(ingress.metadata.namespace, ingress.metadata.name)"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div v-if="selectedResourceDetails" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Detalhes do Recurso</h3>

            <button class="cancel-btn" @click="closeResourceDetails">
              Fechar
            </button>
          </div>

          <pre>{{ JSON.stringify(selectedResourceDetails, null, 2) }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

:root {
  --primary: #8b7355;
  --primary-light: #b59a7a;

  --background:
    linear-gradient(
      135deg,
      #f6f3ef 0%,
      #ece8e1 45%,
      #e4e0d9 100%
    );

  --card:
    rgba(255, 255, 255, 0.72);

  --border:
    rgba(255,255,255,0.45);

  --text: #2d2d2d;
  --text-soft: #7a7a7a;

  --shadow:
    0 10px 40px rgba(80, 65, 50, 0.08);

  --shadow-hover:
    0 20px 45px rgba(80,65,50,0.14);
}

body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}

.app {
  min-height: 100vh;
  display: flex;
  background: var(--background);
  color: var(--text);
  font-family:
    Inter,
    SF Pro Display,
    Arial,
    sans-serif;
}

/* SIDEBAR */

.sidebar {
  width: 285px;

  background:
    rgba(255,255,255,0.55);

  backdrop-filter: blur(18px);

  border-right:
    1px solid rgba(255,255,255,0.5);

  padding: 34px 24px;

  position: sticky;
  top: 0;

  height: 100vh;

  box-shadow:
    var(--shadow);
}

.logo {
  margin-bottom: 40px;
}

.logo h1 {
  margin: 0;

  font-size: 46px;

  font-weight: 900;

  letter-spacing: -2px;

  color: var(--primary);
}

.logo p {
  margin-top: 6px;

  color: var(--text-soft);

  font-size: 15px;
}

/* MENU */

nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

nav button {
  border: none;

  background: transparent;

  color: #5e5e5e;

  padding: 16px 18px;

  border-radius: 18px;

  text-align: left;

  font-size: 15px;

  font-weight: 600;

  cursor: pointer;

  transition: 0.28s ease;
}

nav button:hover {
  background:
    rgba(255,255,255,0.65);

  transform: translateX(4px);
}

nav button.active {
  background:
    linear-gradient(
      135deg,
      #8b7355,
      #b59a7a
    );

  color: white;

  box-shadow:
    0 10px 30px rgba(139,115,85,0.25);
}

/* CONTENT */

.content {
  flex: 1;

  padding: 36px;

  overflow-x: auto;
}

/* TOPBAR */

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: 28px;
}

.topbar h2 {
  margin: 0;

  font-size: 42px;

  font-weight: 900;

  letter-spacing: -2px;

  color: #2f2f2f;
}

.topbar p {
  margin-top: 8px;

  color: var(--text-soft);

  font-size: 16px;
}

/* BUTTONS */

.refresh-btn,
.form button,
.details-btn,
.scale-btn,
.cancel-btn,
.delete-btn {
  border: none;

  cursor: pointer;

  transition: 0.25s ease;
}

.refresh-btn {
  background:
    linear-gradient(
      135deg,
      #8b7355,
      #b59a7a
    );

  color: white;

  padding: 15px 24px;

  border-radius: 18px;

  font-weight: 700;

  box-shadow:
    0 12px 28px rgba(139,115,85,0.25);
}

.refresh-btn:hover {
  transform: translateY(-2px);
}

/* SECTION */

.section {
  background:
    rgba(255,255,255,0.55);

  backdrop-filter: blur(16px);

  border:
    1px solid rgba(255,255,255,0.45);

  border-radius: 28px;

  padding: 34px;

  box-shadow:
    var(--shadow);
}

.section h3 {
  margin-top: 0;

  font-size: 30px;

  font-weight: 800;

  margin-bottom: 28px;
}

/* CARDS */

.cards {
  display: grid;

  grid-template-columns:
    repeat(auto-fit, minmax(220px, 1fr));

  gap: 22px;

  margin-bottom: 30px;
}

.card {
  background:
    rgba(255,255,255,0.65);

  border:
    1px solid rgba(255,255,255,0.5);

  border-radius: 24px;

  padding: 28px;

  box-shadow:
    0 10px 25px rgba(0,0,0,0.04);

  transition: 0.25s ease;
}

.card:hover {
  transform: translateY(-5px);

  box-shadow:
    var(--shadow-hover);
}

.card span {
  display: block;

  color: var(--text-soft);

  margin-bottom: 10px;

  font-size: 15px;
}

.card strong {
  font-size: 42px;

  font-weight: 900;

  color: var(--primary);
}

/* PANELS */

.panel {
  background:
    rgba(255,255,255,0.55);

  border:
    1px solid rgba(255,255,255,0.4);

  border-radius: 22px;

  padding: 24px;

  margin-bottom: 24px;
}

/* ALERTS */

.message {
  padding: 16px 18px;

  border-radius: 16px;

  margin-bottom: 24px;

  font-weight: 600;
}

.message.info {
  background: #ebe6df;
  color: #7b644f;
}

.message.error {
  background: #fde8e8;
  color: #b42318;
}

.message.success {
  background: #e7f6ea;
  color: #067647;
}

/* FORMS */

.form {
  display: flex;
  flex-wrap: wrap;

  gap: 14px;

  margin-bottom: 26px;
}

.form input,
.form select {
  background:
    rgba(255,255,255,0.8);

  border:
    1px solid #ddd4ca;

  border-radius: 16px;

  padding: 14px 16px;

  min-width: 210px;

  font-size: 14px;

  color: #2d2d2d;

  outline: none;

  transition: 0.25s ease;
}

.form input:focus,
.form select:focus {
  border-color: var(--primary);

  box-shadow:
    0 0 0 4px rgba(181,154,122,0.15);
}

.form button {
  background:
    linear-gradient(
      135deg,
      #8b7355,
      #b59a7a
    );

  color: white;

  border-radius: 16px;

  padding: 14px 22px;

  font-weight: 700;
}

/* FILTER */

.filter {
  display: flex;
  align-items: center;

  gap: 14px;

  margin-bottom: 22px;
}

.filter label {
  font-weight: 700;

  color: #444;
}

.filter select {
  padding: 12px 14px;

  border-radius: 14px;

  border: 1px solid #ddd;
}

/* TABLES */

table {
  width: 100%;

  border-collapse: collapse;

  overflow: hidden;

  border-radius: 20px;

  background:
    rgba(255,255,255,0.65);
}

th {
  background:
    rgba(255,255,255,0.8);

  color: #5c5c5c;

  font-size: 14px;

  font-weight: 700;

  padding: 18px;
}

td {
  padding: 18px;

  border-top:
    1px solid rgba(0,0,0,0.05);

  font-size: 14px;
}

tr:hover {
  background:
    rgba(255,255,255,0.5);
}

/* BADGES */

.badge {
  padding: 7px 12px;

  border-radius: 999px;

  font-size: 12px;

  font-weight: 700;
}

.badge.green {
  background: #d1fadf;
  color: #027a48;
}

.badge.red {
  background: #fee4e2;
  color: #b42318;
}

.badge.orange {
  background: #fff3d6;
  color: #b54708;
}

/* ACTION BUTTONS */

.details-btn {
  background: #4b5563;
  color: white;

  padding: 9px 13px;

  border-radius: 12px;

  margin-right: 8px;
}

.scale-btn {
  background: #7c3aed;
  color: white;

  padding: 9px 13px;

  border-radius: 12px;

  margin-right: 8px;
}

.delete-btn {
  background: #dc2626;
  color: white;

  padding: 9px 13px;

  border-radius: 12px;
}

.cancel-btn {
  background: #6b7280;
  color: white;

  padding: 9px 13px;

  border-radius: 12px;
}

/* MODAL */

.modal {
  position: fixed;

  inset: 0;

  background:
    rgba(20,20,20,0.55);

  backdrop-filter: blur(8px);

  display: flex;
  justify-content: center;
  align-items: center;

  padding: 30px;

  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 1100px;

  max-height: 85vh;

  overflow: auto;

  background:
    rgba(255,255,255,0.9);

  border-radius: 26px;

  padding: 28px;

  box-shadow:
    0 20px 50px rgba(0,0,0,0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: 20px;
}

.modal-content pre {
  background: #2d2d2d;

  color: #f8f8f8;

  padding: 22px;

  border-radius: 18px;

  overflow: auto;

  font-size: 13px;
}

/* RESPONSIVE */

@media (max-width: 1000px) {
  .app {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    position: relative;
  }

  nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .topbar h2 {
    font-size: 32px;
  }
}
</style>