<script setup>
import { ref, onMounted, computed } from "vue";

const resource = ref(null);
const interfaces = ref([]);
const bridges = ref([]);
const error = ref("");
const wirelessOnly = ref(false);

const filteredInterfaces = computed(() => {
  if (wirelessOnly.value) {
    return interfaces.value.filter((i) => i.type === "wlan");
  }
  return interfaces.value;
});

onMounted(async () => {
  try {
    const resourceResponse = await fetch("http://localhost:3000/api/system-resource");
    const resourceData = await resourceResponse.json();
    resource.value = resourceData;

    const interfacesResponse = await fetch("http://localhost:3000/api/interfaces");
    const interfacesData = await interfacesResponse.json();
    interfaces.value = interfacesData;

    const bridgesResponse = await fetch("http://localhost:3000/api/bridges");
    const bridgesData = await bridgesResponse.json();
    bridges.value = bridgesData;
  } catch (err) {
    error.value = "Erro ao carregar dados do router.";
  }
});
</script>

<template>
  <div style="padding: 20px">
    <h1>Controlador SDN MikroTik</h1>

    <p v-if="error">{{ error }}</p>

    <div v-if="resource">
      <p><strong>Board:</strong> {{ resource["board-name"] }}</p>
      <p><strong>CPU:</strong> {{ resource["cpu"] }}</p>
      <p><strong>Versão:</strong> {{ resource["version"] }}</p>
      <p><strong>Uptime:</strong> {{ resource["uptime"] }}</p>
      <p><strong>Arquitetura:</strong> {{ resource["architecture-name"] }}</p>
      <p><strong>CPU Load:</strong> {{ resource["cpu-load"] }}%</p>
      <p><strong>Memória Livre:</strong> {{ resource["free-memory"] }}</p>
    </div>

    <hr style="margin: 24px 0" />

    <h2>Interfaces</h2>

    <button @click="wirelessOnly = !wirelessOnly" style="margin-bottom: 10px">
      {{ wirelessOnly ? "Mostrar Todas" : "Mostrar Só Wireless" }}
    </button>

    <table v-if="filteredInterfaces.length" border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Tipo</th>
          <th>MTU</th>
          <th>MAC</th>
          <th>Running</th>
          <th>Disabled</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="iface in filteredInterfaces" :key="iface['.id']">
          <td>{{ iface.name }}</td>
          <td>{{ iface.type }}</td>
          <td>{{ iface.mtu }}</td>
          <td>{{ iface["mac-address"] }}</td>
          <td>{{ iface.running }}</td>
          <td>{{ iface.disabled }}</td>
        </tr>
      </tbody>
    </table>

    <p v-else>Nenhuma interface encontrada.</p>

    <hr style="margin: 24px 0" />

    <h2>Bridges</h2>

    <table v-if="bridges.length" border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th>Nome</th>
          <th>MTU</th>
          <th>Running</th>
          <th>Disabled</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="bridge in bridges" :key="bridge['.id']">
          <td>{{ bridge.name }}</td>
          <td>{{ bridge.mtu }}</td>
          <td>{{ bridge.running }}</td>
          <td>{{ bridge.disabled }}</td>
        </tr>
      </tbody>
    </table>

    <p v-else>Nenhuma bridge encontrada.</p>
  </div>
</template>