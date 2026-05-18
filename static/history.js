let currentEditingTaskId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAllTasks();
    loadClientsInEditModal();

    document.getElementById('menuBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('dropdownMenu').classList.toggle('show');
    });

    window.addEventListener('click', () => {
        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown && dropdown.classList.contains('show')) dropdown.classList.remove('show');
    });

    document.getElementById('menuExport').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.storage.local.get({tasks: []}, (data) => {
            const blob = new Blob([JSON.stringify(data.tasks, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tarefas_backup.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    document.getElementById('menuImport').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('importFile').click();
    });
    
    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                chrome.storage.local.set({tasks: JSON.parse(event.target.result)}, () => {
                    alert('Tarefas importadas com sucesso!');
                    loadAllTasks();
                });
            } catch (err) { alert('Erro ao ler arquivo JSON.'); }
        };
        reader.readAsText(file);
    });

    document.getElementById('searchInput').addEventListener('input', loadAllTasks);
    document.getElementById('statusFilter').addEventListener('change', loadAllTasks);

    document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEditedTask);
});

function loadClientsInEditModal() {
    chrome.storage.local.get({clients: []}, (data) => {
        const select = document.getElementById('editTaskClient');
        data.clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            select.appendChild(opt);
        });
    });
}

function loadAllTasks() {
    chrome.storage.local.get({tasks: []}, (data) => {
        let tasks = data.tasks;
        let needsUpdate = false;
        const nowTime = Date.now();

        // Limpa todas as colunas do Kanban antes de renderizar
        document.getElementById('list-nova').innerHTML = '';
        document.getElementById('list-em_progresso').innerHTML = '';
        document.getElementById('list-atrasada').innerHTML = '';
        document.getElementById('list-concluida').innerHTML = '';

        tasks = tasks.map(t => {
            if (!t.status) { t.status = 'nova'; needsUpdate = true; }
            
            if (!t.completed) {
                if (t.dueDate < nowTime) {
                    if (t.status !== 'atrasada') { t.status = 'atrasada'; needsUpdate = true; }
                } else if (t.status === 'nova' && (nowTime - t.createdAt >= 300000)) {
                    t.status = 'em_progresso'; needsUpdate = true;
                }
            }
            return t;
        });

        if (needsUpdate) chrome.storage.local.set({tasks});

        const searchQuery = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        const filteredTasks = tasks.filter(task => {
            const matchText = task.description.toLowerCase().includes(searchQuery) || 
                              (task.client && task.client.toLowerCase().includes(searchQuery));
            const matchStatus = statusFilter === 'todos' || task.status === statusFilter;
            return matchText && matchStatus;
        });

        filteredTasks.forEach(task => {
            const subtasks = task.subtasks || [];
            let subtasksHTML = '';
            
            if (subtasks.length > 0) {
                subtasksHTML = `<div class="subtasks-container">`;
                subtasks.forEach(sub => {
                    const isCrossed = sub.completed || task.completed;
                    subtasksHTML += `
                        <div class="subtask-item">
                            <div class="subtask-item-content">
                                <span style="${isCrossed ? 'text-decoration: line-through; color: #9aa0a6;' : ''}">${sub.description}</span>
                            </div>
                        </div>`;
                });
                subtasksHTML += `</div>`;
            }

            let statusText = 'Nova Tarefa';
            let statusClass = 'status-nova';
            if (task.status === 'em_progresso') { statusText = 'Em Progresso'; statusClass = 'status-progresso'; }
            if (task.status === 'atrasada') { statusText = 'Em Atraso'; statusClass = 'status-atrasada'; }
            if (task.completed) { statusText = 'Concluída'; statusClass = 'status-concluida'; }

            const statusBadge = `<div class="status-badge ${statusClass}">${task.status === 'atrasada' ? '🚨' : '⚡'} ${statusText}</div>`;
            const clientBadge = task.client ? `<div class="client-badge">🏢 Cliente: ${task.client}</div>` : '';
            const badgesContainer = `<div class="badges-container">${statusBadge}${clientBadge}</div>`;

            const li = document.createElement('li');
            li.className = 'task-item';
            li.innerHTML = `
                ${badgesContainer}
                <div class="task-header">
                    <strong style="${task.completed ? 'text-decoration: line-through; color: #9aa0a6;' : ''}; font-size: 14px;">${task.description}</strong>
                </div>
                <small style="color: #80868b; margin-top: 4px;">Entrega: ${new Date(task.dueDate).toLocaleString()}</small>
                ${subtasksHTML}
                <div class="controls">
                    ${task.completed ? 
                        `<button class="btn-chip" data-id="${task.id}" data-action="reactivate">Reativar</button>` : 
                        `<button class="btn-chip primary" data-id="${task.id}" data-action="complete">Concluir</button>`
                    }
                    <button class="btn-chip warning btn-edit" data-id="${task.id}">Editar</button>
                    <button class="btn-chip danger btn-delete" data-id="${task.id}">Excluir</button>
                </div>
            `;

            // Identifica qual coluna receberá a tarefa
            const columnTarget = document.getElementById(`list-${task.status}`);
            if (columnTarget) {
                columnTarget.appendChild(li);
            }
        });

        document.querySelectorAll('.btn-chip[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                changeStatus(e.target.getAttribute('data-id'), e.target.getAttribute('data-action') === 'complete');
            });
        });

        document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => openEditModal(e.target.getAttribute('data-id'))));
        document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => deleteTask(e.target.getAttribute('data-id'))));
    });
}

function openEditModal(id) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const task = data.tasks.find(t => t.id === id);
        if(!task) return;
        currentEditingTaskId = id;

        document.getElementById('editTaskDesc').value = task.description;
        document.getElementById('editTaskClient').value = task.client || "";

        const d = new Date(task.dueDate);
        document.getElementById('editTaskDate').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        document.getElementById('editTaskTime').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        const subList = document.getElementById('editSubtasksList');
        subList.innerHTML = '';
        if(task.subtasks && task.subtasks.length > 0){
            task.subtasks.forEach(sub => {
                subList.innerHTML += `
                    <div class="edit-subtask-row">
                        <span style="font-size:16px; color:#ccc;">↳</span>
                        <input type="text" class="edit-sub-input" data-sub-id="${sub.id}" value="${sub.description}">
                    </div>`;
            });
        } else {
            subList.innerHTML = '<span style="font-size:12px; color:#888;">Nenhuma subtarefa.</span>';
        }

        const modal = document.getElementById('editModal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    });
}

function closeModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; currentEditingTaskId = null; }, 300);
}

function saveEditedTask() {
    if(!currentEditingTaskId) return;

    const newDesc = document.getElementById('editTaskDesc').value.trim();
    const newClient = document.getElementById('editTaskClient').value;
    const newDate = document.getElementById('editTaskDate').value;
    const newTime = document.getElementById('editTaskTime').value;

    if (!newDesc || !newDate || !newTime) return alert("Preencha descrição, data e hora!");

    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === currentEditingTaskId) {
                t.description = newDesc;
                t.client = newClient;
                t.dueDate = new Date(`${newDate}T${newTime}`).getTime();
                
                if (t.status === 'atrasada' && t.dueDate >= Date.now()) {
                    t.status = 'em_progresso';
                }

                const subInputs = document.querySelectorAll('.edit-sub-input');
                subInputs.forEach(input => {
                    const subId = input.getAttribute('data-sub-id');
                    const subTask = t.subtasks.find(s => s.id === subId);
                    if(subTask) subTask.description = input.value.trim();
                });
            }
            return t;
        });

        chrome.storage.local.set({tasks}, () => {
            closeModal();
            loadAllTasks();
        });
    });
}

function changeStatus(id, status) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => { 
            if (t.id === id) {
                t.completed = status;
                if(status) {
                    t.status = 'concluida';
                    if(t.subtasks) t.subtasks = t.subtasks.map(s => ({ ...s, completed: true }));
                } else {
                    t.status = (t.dueDate < Date.now()) ? 'atrasada' : 'em_progresso';
                }
            } 
            return t; 
        });
        chrome.storage.local.set({tasks}, loadAllTasks);
    });
}

function deleteTask(id) {
    if(!confirm("Tem certeza que deseja excluir esta tarefa e suas subtarefas?")) return;
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.filter(t => t.id !== id);
        chrome.storage.local.set({tasks}, loadAllTasks);
    });
}