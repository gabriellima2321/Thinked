document.addEventListener('DOMContentLoaded', () => {
    setDefaultDateTime();
    loadActiveTasks();
    loadSubjectsInSelect(); 

    document.getElementById('addTaskBtn').addEventListener('click', () => {
        const titleVal = document.getElementById('taskTitle').value.trim();
        const descVal = document.getElementById('taskDesc').value.trim();
        const dateVal = document.getElementById('taskDate').value;
        const timeVal = document.getElementById('taskTime').value;
        const subjectVal = document.getElementById('taskSubject').value; 
        const linkVal = document.getElementById('taskLink').value.trim(); 
        
        if (!titleVal || !dateVal || !timeVal) return alert("Preencha o título, data e hora!");

        const newTask = {
            id: Date.now().toString(),
            title: titleVal, 
            description: descVal, 
            subject: subjectVal, 
            link: linkVal, 
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
                document.getElementById('taskTitle').value = '';
                document.getElementById('taskDesc').value = '';
                document.getElementById('taskSubject').value = ''; 
                document.getElementById('taskLink').value = ''; 
                setDefaultDateTime();
                loadActiveTasks();
            });
        });
    });

    document.getElementById('openHistory').addEventListener('click', () => chrome.tabs.create({url: 'history.html'}));
    
    // ======== LÓGICA DO MODAL DE MATÉRIAS ========
    document.getElementById('manageSubjectsBtn').addEventListener('click', openSubjectsModal);
    document.getElementById('closeSubjectsModalBtn').addEventListener('click', closeSubjectsModal);
    document.getElementById('addSubjectBtn').addEventListener('click', addSubject);
});

function loadSubjectsInSelect() {
    chrome.storage.local.get({subjects: []}, (data) => {
        const select = document.getElementById('taskSubject');
        select.innerHTML = '<option value="">Nenhuma matéria (Opcional)</option>'; 
        data.subjects.forEach(c => {
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
                if (t.dueDate < nowTime) {
                    if (t.status !== 'atrasada') { t.status = 'atrasada'; needsUpdate = true; }
                } else if (t.status === 'nova' && (nowTime - t.createdAt >= 300000)) { 
                    t.status = 'em_progresso'; needsUpdate = true;
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
            let percent = totalTime > 0 ? (elapsedTime / totalTime) * 100 : 100;
            if (percent < 0) percent = 0;
            if (percent > 100) percent = 100;

            const subtasks = task.subtasks || []; 
            let subtasksHTML = '';
            if (subtasks.length > 0) {
                subtasksHTML = `<div class="subtasks-container expanded">`;
                subtasks.forEach(sub => {
                    const isCompleted = sub.completed ? 'completed' : '';
                    const isChecked = sub.completed ? 'checked' : '';
                    subtasksHTML += `
                        <div class="subtask-item ${isCompleted}" id="subtask-item-${sub.id}">
                            <div class="subtask-item-content">
                                <input type="checkbox" class="subtask-chk" data-task-id="${task.id}" data-sub-id="${sub.id}" ${isChecked}>
                                <span>${sub.description}</span>
                            </div>
                        </div>`;
                });
                subtasksHTML += `</div>`;
            }

            const li = document.createElement('li');
            li.className = 'task-item';
            li.id = `task-item-${task.id}`; 
            
            let statusText = 'Nova Tarefa';
            let statusClass = 'status-nova';
            if (task.status === 'em_progresso') { statusText = 'Em Progresso'; statusClass = 'status-progresso'; }
            if (task.status === 'atrasada') { statusText = 'Em Atraso'; statusClass = 'status-atrasada'; }

            const statusBadge = `<div class="status-badge ${statusClass}">${task.status === 'atrasada' ? '🚨' : '⚡'} ${statusText}</div>`;
            const subjectBadge = task.subject ? `<div class="subject-badge">📚 Matéria: ${task.subject}</div>` : '';
            const linkBadge = task.link ? `<a href="${task.link}" target="_blank" class="link-badge" title="${task.link}">🔗 Link</a>` : '';

            li.innerHTML = `
                <div class="badges-container">${statusBadge}${subjectBadge}${linkBadge}</div>
                <div class="task-header">
                    <div class="task-title-area" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                            <span style="font-weight: 600; font-size: 15px;">${task.title || 'Sem Título'}</span>
                            <button class="btn-add-subtask" data-id="${task.id}">+</button>
                        </div>
                        ${task.description ? `<span style="font-size: 13px; color: #5f6368; font-weight: normal;">${task.description}</span>` : ''}
                    </div>
                    <input type="checkbox" class="complete-chk" data-id="${task.id}">
                </div>
                <small>Entrega: ${new Date(task.dueDate).toLocaleString()}</small>
                <div class="progress-container"><div class="progress-bar" style="width: ${percent}%"></div></div>
                ${subtasksHTML}
                <div class="subtask-input-area" id="input-area-${task.id}">
                    <input type="text" id="subtask-input-${task.id}" placeholder="Nova subtarefa...">
                    <button class="btn-save-subtask" data-id="${task.id}">Salvar</button>
                </div>
            `;
            list.appendChild(li);
        });

        document.querySelectorAll('.complete-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                e.target.disabled = true;
                document.getElementById(`task-item-${id}`).classList.add('completing');
                setTimeout(() => toggleTaskStatus(id, true), 600); 
            });
        });

        document.querySelectorAll('.subtask-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const taskId = e.target.getAttribute('data-task-id');
                const subId = e.target.getAttribute('data-sub-id');
                const isChecked = e.target.checked;
                const itemDiv = document.getElementById(`subtask-item-${subId}`);
                isChecked ? itemDiv.classList.add('completed') : itemDiv.classList.remove('completed');
                toggleSubtaskStatus(taskId, subId, isChecked);
            });
        });

        document.querySelectorAll('.btn-add-subtask').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.getAttribute('data-id');
                const task = data.tasks.find(t => t.id === taskId);
                if (task.subtasks && task.subtasks.length >= 10) return alert("Limite de 10 subtarefas.");
                document.getElementById(`input-area-${taskId}`).classList.toggle('active'); 
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
                t.subtasks = t.subtasks.map(s => { if (s.id === subId) s.completed = status; return s; });
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
                if (status) { t.status = 'concluida'; if (t.subtasks) t.subtasks = t.subtasks.map(s => ({ ...s, completed: true })); }
            }
            return t;
        });
        chrome.storage.local.set({tasks}, loadActiveTasks);
    });
}

// ======== FUNÇÕES DE GERENCIAMENTO DE MATÉRIAS ========
function openSubjectsModal() {
    renderSubjectsList();
    const modal = document.getElementById('subjectsModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeSubjectsModal() {
    const modal = document.getElementById('subjectsModal');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
    loadSubjectsInSelect();
    loadActiveTasks();
}

function renderSubjectsList() {
    chrome.storage.local.get({subjects: []}, (data) => {
        const list = document.getElementById('subjectsModalList');
        list.innerHTML = '';
        data.subjects.forEach(sub => {
            const li = document.createElement('li');
            li.className = 'modal-subject-item';
            
            const span = document.createElement('span');
            span.style.fontWeight = '500';
            span.textContent = sub.name;
            
            const actions = document.createElement('div');
            actions.className = 'modal-subject-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-icon';
            editBtn.textContent = '✏️';
            editBtn.title = "Editar";
            editBtn.addEventListener('click', () => editSubject(sub.name));
            
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-icon';
            delBtn.style.color = '#ea4335';
            delBtn.textContent = '🗑️';
            delBtn.title = "Excluir";
            delBtn.addEventListener('click', () => deleteSubject(sub.name));
            
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            
            li.appendChild(span);
            li.appendChild(actions);
            list.appendChild(li);
        });
    });
}

function addSubject() {
    const input = document.getElementById('newSubjectInput');
    const name = input.value.trim();
    if(!name) return;
    chrome.storage.local.get({subjects: []}, (data) => {
        if(data.subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
            alert('Matéria já existe!'); return;
        }
        data.subjects.push({name, color: '#9c27b0'});
        chrome.storage.local.set({subjects: data.subjects}, () => {
            input.value = '';
            renderSubjectsList();
        });
    });
}

function editSubject(oldName) {
    const newName = prompt(`Novo nome para a matéria "${oldName}":`, oldName);
    if(!newName || newName.trim() === '' || newName === oldName) return;
    const finalName = newName.trim();
    
    chrome.storage.local.get({subjects: [], tasks: []}, (data) => {
        if(data.subjects.find(s => s.name.toLowerCase() === finalName.toLowerCase())) {
            alert('Já existe uma matéria com este nome!'); return;
        }
        
        const subjects = data.subjects.map(s => {
            if(s.name === oldName) s.name = finalName;
            return s;
        });
        const tasks = data.tasks.map(t => {
            if(t.subject === oldName) t.subject = finalName;
            return t;
        });
        
        chrome.storage.local.set({subjects, tasks}, () => {
            renderSubjectsList();
            loadActiveTasks();
        });
    });
}

function deleteSubject(name) {
    if(!confirm(`Tem certeza que deseja excluir a matéria "${name}"? As tarefas vinculadas a ela não serão apagadas, mas ficarão sem matéria.`)) return;
    chrome.storage.local.get({subjects: [], tasks: []}, (data) => {
        const subjects = data.subjects.filter(s => s.name !== name);
        const tasks = data.tasks.map(t => {
            if(t.subject === name) t.subject = '';
            return t;
        });
        chrome.storage.local.set({subjects, tasks}, () => {
            renderSubjectsList();
            loadActiveTasks();
        });
    });
}