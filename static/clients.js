document.addEventListener('DOMContentLoaded', () => {
    loadClients();

    document.getElementById('addClientBtn').addEventListener('click', () => {
        const nameInput = document.getElementById('clientName');
        const name = nameInput.value.trim();

        if (!name) return alert("Digite um nome para o cliente!");

        chrome.storage.local.get({clients: []}, (data) => {
            const clients = data.clients;
            
            if(clients.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                return alert("Já existe um cliente com este nome.");
            }

            clients.push({ id: Date.now().toString(), name: name });
            
            chrome.storage.local.set({clients}, () => {
                nameInput.value = '';
                loadClients();
            });
        });
    });
});

function loadClients() {
    chrome.storage.local.get({clients: []}, (data) => {
        const list = document.getElementById('clientsList');
        list.innerHTML = '';

        if (data.clients.length === 0) {
            list.innerHTML = '<p style="color: #888; text-align: center; margin-top: 20px; font-style: italic;">Nenhum cliente cadastrado ainda.</p>';
            return;
        }

        data.clients.forEach(client => {
            const li = document.createElement('li');
            li.className = 'client-item';
            // Aplicamos os novos botões estilo "chip" e a estrutura de card
            li.innerHTML = `
                <strong>${client.name}</strong>
                <button class="btn-chip danger btn-delete-client" data-id="${client.id}">Excluir</button>
            `;
            list.appendChild(li);
        });

        document.querySelectorAll('.btn-delete-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                deleteClient(id);
            });
        });
    });
}

function deleteClient(id) {
    if(!confirm("Tem certeza que deseja excluir este cliente? As tarefas antigas continuarão com o nome dele no histórico.")) return;
    
    chrome.storage.local.get({clients: []}, (data) => {
        const clients = data.clients.filter(c => c.id !== id);
        chrome.storage.local.set({clients}, loadClients);
    });
}