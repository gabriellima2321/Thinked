document.addEventListener('DOMContentLoaded', () => {
    setDefaultDateTime();
    loadActiveTasks();
    loadClientsInSelect(); 

    document.getElementById('addTaskBtn').addEventListener('click', () => {
        const desc = document.getElementById('taskDesc').value;
        const dateVal = document.getElementById('taskDate').value;
        const timeVal = document.getElementById('taskTime').value;
        const clientVal = document.getElementById('taskClient').value; 
        
        if (!desc || !dateVal || !timeVal) return alert("Preencha descrição, data e hora!");

        const newTask = {
            id: Date.now().toString(),
            description: desc,
            client: clientVal, 
            createdAt: new Date().getTime(),
            dueDate: new Date(`${dateVal}T${timeVal}`).getTime(),
            completed: false,
            status: 'nova', 
            subtasks: []
        };

        chrome.storage.local.get({tasks: []}, (data) => {
            const tasks = data.tasks;
            tasks.push(newTask);
            chrome.storage.local.set({tasks}, () => {
                document.getElementById('taskDesc').value = '';
                document.getElementById('taskClient').value = ''; 
                setDefaultDateTime();
                loadActiveTasks();
            });
        });
    });

    document.getElementById('openHistory').addEventListener('click', () => chrome.tabs.create({url: 'history.html'}));
    document.getElementById('manageClientsBtn').addEventListener('click', () => chrome.tabs.create({url: 'clients.html'}));
});

function loadClientsInSelect() {
    chrome.storage.local.get({clients: []}, (data) => {
        const select = document.getElementById('taskClient');
        select.innerHTML = '<option value="">Nenhum cliente (Opcional)</option>'; 
        data.clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            select.appendChild(opt);
        });
    });
}

function setDefaultDateTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    document.getElementById('taskDate').value = `${year}-${month}-${day}`;
    document.getElementById('taskTime').value = `${hours}:${minutes}`;
}

function loadActiveTasks() {
    chrome.storage.local.get({tasks: []}, (data) => {
        let tasks = data.tasks;
        let needsUpdate = false;
        const nowTime = Date.now();

        tasks = tasks.map(t => {
            if (!t.status) { t.status = 'nova'; needsUpdate = true; } 
            
            if (!t.completed) {
                // Nova Regra de Atraso no Popup
                if (t.dueDate < nowTime) {
                    if (t.status !== 'atrasada') { t.status = 'atrasada'; needsUpdate = true; }
                } 
                else if (t.status === 'nova' && (nowTime - t.createdAt >= 500000000)) { 
                    t.status = 'em_progresso';
                    needsUpdate = true;
                }
            }
            return t;
        });

        if (needsUpdate) chrome.storage.local.set({tasks});

        const activeTasks = tasks.filter(t => !t.completed);
        const list = document.getElementById('activeTasks');
        list.innerHTML = '';

        activeTasks.forEach(task => {
            const totalTime = task.dueDate - task.createdAt;
            const elapsedTime = nowTime - task.createdAt;
            
            let percent = 0;
            if (totalTime > 0) percent = (elapsedTime / totalTime) * 100;
            else percent = 100;
            
            if (percent < 0) percent = 0;
            if (percent > 100) percent = 100;

            const subtasks = task.subtasks || []; 
            let subtasksHTML = '';
            if (subtasks.length > 0) {
                subtasksHTML = `<div class="subtasks-container">`;
                subtasks.forEach(sub => {
                    const isCompleted = sub.completed ? 'completed' : '';
                    const isChecked = sub.completed ? 'checked' : '';
                    subtasksHTML += `
                        <div class="subtask-item ${isCompleted}" id="subtask-item-${sub.id}">
                            <div class="subtask-item-content">
                                <input type="checkbox" class="subtask-chk" data-task-id="${task.id}" data-sub-id="${sub.id}" ${isChecked} title="Concluir subtarefa">
                                <span>${sub.description}</span>
                            </div>
                        </div>`;
                });
                subtasksHTML += `</div>`;
            }

            const li = document.createElement('li');
            li.className = 'task-item';
            li.id = `task-item-${task.id}`; 
            
            // Selo do status agora reflete Atrasadas
            let statusText = 'Nova Tarefa';
            let statusClass = 'status-nova';
            if (task.status === 'em_progresso') { statusText = 'Em Progresso'; statusClass = 'status-progresso'; }
            if (task.status === 'atrasada') { statusText = 'Em Atraso'; statusClass = 'status-atrasada'; }

            const statusBadge = `<div class="status-badge ${statusClass}">${task.status === 'atrasada' ? '🚨' : '⚡'} ${statusText}</div>`;
            const clientBadge = task.client ? `<div class="client-badge">🏢 Cliente: ${task.client}</div>` : '';
            const badgesContainer = `<div class="badges-container">${statusBadge}${clientBadge}</div>`;

            li.innerHTML = `
                ${badgesContainer}
                <div class="task-header">
                    <div class="task-title-area">
                        <span>${task.description}</span>
                        <button class="btn-add-subtask" data-id="${task.id}" title="Adicionar subtarefa">+</button>
                    </div>
                    <input type="checkbox" class="complete-chk" data-id="${task.id}" title="Concluir tarefa principal">
                </div>
                <small>Entrega: ${new Date(task.dueDate).toLocaleString()}</small>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
                ${subtasksHTML}
                <div class="subtask-input-area" id="input-area-${task.id}">
                    <input type="text" id="subtask-input-${task.id}" placeholder="Nova subtarefa (máx 10)...">
                    <button class="btn-save-subtask" data-id="${task.id}">Salvar</button>
                </div>
            `;
            list.appendChild(li);
        });

        document.querySelectorAll('.complete-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const taskElement = document.getElementById(`task-item-${id}`);
                e.target.disabled = true;
                taskElement.classList.add('completing');
                setTimeout(() => toggleTaskStatus(id, true), 600); 
            });
        });

        document.querySelectorAll('.subtask-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const taskId = e.target.getAttribute('data-task-id');
                const subId = e.target.getAttribute('data-sub-id');
                const isChecked = e.target.checked;
                
                const itemDiv = document.getElementById(`subtask-item-${subId}`);
                if (isChecked) itemDiv.classList.add('completed');
                else itemDiv.classList.remove('completed');
                
                toggleSubtaskStatus(taskId, subId, isChecked);
            });
        });

        document.querySelectorAll('.btn-add-subtask').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.getAttribute('data-id');
                const task = data.tasks.find(t => t.id === taskId);
                if (task.subtasks && task.subtasks.length >= 10) return alert("Esta tarefa já atingiu o limite de 10 subtarefas.");
                const inputArea = document.getElementById(`input-area-${taskId}`);
                inputArea.classList.toggle('active'); 
                document.getElementById(`subtask-input-${taskId}`).focus();
            });
        });

        document.querySelectorAll('.btn-save-subtask').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.getAttribute('data-id');
                const subDesc = document.getElementById(`subtask-input-${taskId}`).value.trim();
                if (subDesc) addSubtask(taskId, subDesc);
            });
        });
    });
}

function addSubtask(taskId, description) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === taskId) {
                if (!t.subtasks) t.subtasks = [];
                if (t.subtasks.length < 10) {
                    t.subtasks.push({ id: Date.now().toString(), description: description, completed: false });
                    // Só altera para em progresso se não estiver atrasada
                    if (t.status === 'nova') t.status = 'em_progresso'; 
                }
            }
            return t;
        });
        chrome.storage.local.set({tasks}, loadActiveTasks);
    });
}

function toggleSubtaskStatus(taskId, subId, status) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === taskId && t.subtasks) {
                t.subtasks = t.subtasks.map(s => {
                    if (s.id === subId) s.completed = status;
                    return s;
                });
            }
            return t;
        });
        chrome.storage.local.set({tasks}); 
    });
}

function toggleTaskStatus(id, status) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === id) {
                t.completed = status;
                if (status) {
                    t.status = 'concluida';
                    if (t.subtasks) t.subtasks = t.subtasks.map(s => ({ ...s, completed: true }));
                }
            }
            return t;
        });
        chrome.storage.local.set({tasks}, loadActiveTasks);
    });
}