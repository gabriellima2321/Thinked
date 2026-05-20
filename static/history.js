let currentEditingTaskId = null;

document.addEventListener('DOMContentLoaded', () => {
    // ======== LÓGICA DO TEMA (DARK/LIGHT MODE) ========
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    chrome.storage.local.get({ theme: 'light' }, (data) => {
        if (data.theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeIcon.src = 'icons/sun.png';
        } else {
            themeIcon.src = 'icons/full-moon.png';
        }
    });

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        const newTheme = isDark ? 'dark' : 'light';
        themeIcon.src = isDark ? 'icons/sun.png' : 'icons/full-moon.png';
        chrome.storage.local.set({ theme: newTheme });
    });

    // ======== LÓGICA DE DROP (ARRASTAR PARA AS COLUNAS) ========
    document.querySelectorAll('.kanban-tasks').forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', (e) => {
            if (!col.contains(e.relatedTarget)) {
                col.classList.remove('drag-over');
            }
        });

        col.addEventListener('drop', (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const targetStatus = col.id.replace('list-', ''); 
            
            if (taskId && targetStatus) {
                const card = document.getElementById(`task-hist-${taskId}`);
                
                if (card && card.parentElement.id !== `list-${targetStatus}`) {
                    card.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 1, 1)';
                    card.style.transform = 'scale(0.5)';
                    card.style.opacity = '0';
                    
                    setTimeout(() => {
                        updateTaskStatusFromDrag(taskId, targetStatus);
                    }, 200);
                }
            }
        });
    });

    loadAllTasks();
    loadAllSubjectsSelects();

    document.getElementById('menuBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('dropdownMenu').classList.toggle('show');
    });

    window.addEventListener('click', () => {
        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown && dropdown.classList.contains('show')) dropdown.classList.remove('show');
    });

    // Ações do Menu
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
                    alert('Tarefas importadas!'); loadAllTasks();
                });
            } catch (err) { alert('Erro ao ler arquivo JSON.'); }
        };
        reader.readAsText(file);
    });

    document.getElementById('menuDeleteAll').addEventListener('click', (e) => {
        e.preventDefault();
        const dropdown = document.getElementById('dropdownMenu');
        if (dropdown) dropdown.classList.remove('show');

        if(confirm("⚠️ ATENÇÃO: Tem certeza ABSOLUTA que deseja EXCLUIR TODAS as tarefas? Isso não pode ser desfeito!")) {
            try { chrome.alarms.clearAll(); } catch(err){} // Apaga alarmes
            chrome.storage.local.set({tasks: []}, () => {
                alert("Todas as tarefas foram excluídas com sucesso.");
                loadAllTasks(); 
            });
        }
    });

    document.getElementById('searchInput').addEventListener('input', loadAllTasks);
    document.getElementById('statusFilter').addEventListener('change', loadAllTasks);
    
    // ======== LÓGICA DE EDIÇÃO ========
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEditedTask);
    
    // ======== LÓGICA DO MODAL DE MATÉRIAS ========
    document.getElementById('menuManageSubjects').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('dropdownMenu').classList.remove('show');
        openSubjectsModal();
    });
    document.getElementById('closeSubjectsModalBtn').addEventListener('click', closeSubjectsModal);
    document.getElementById('addSubjectBtn').addEventListener('click', addSubject);

    // ======== LÓGICA DO MODAL DE ADICIONAR TAREFA ========
    document.getElementById('menuAddTask').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('dropdownMenu').classList.remove('show');
        openAddTaskModal();
    });
    document.getElementById('cancelAddTaskBtn').addEventListener('click', closeAddTaskModal);
    document.getElementById('saveNewTaskBtn').addEventListener('click', saveNewTask);
});

window.toggleSubtasks = function(taskId) {
    const container = document.getElementById(`sub-cont-${taskId}`);
    const btn = document.getElementById(`btn-expand-${taskId}`);
    
    if(container && btn) {
        container.classList.toggle('expanded');
        btn.classList.toggle('rotated');
    }
};

window.toggleAlarm = function(id) {
    chrome.storage.local.get({tasks: []}, (data) => {
        let needsUpdate = false;
        
        const tasks = data.tasks.map(t => {
            if (t.id === id) {
                if (t.alarmSet) {
                    try { chrome.alarms.clear(`task-alert-${id}`); } catch(e) {}
                    t.alarmSet = false;
                    needsUpdate = true;
                } else {
                    const alertTime = Number(t.dueDate) - (5 * 60 * 1000); // 5 min antes
                    
                    if (isNaN(alertTime) || alertTime <= Date.now()) {
                        alert("⚠️ O prazo é muito curto ou já passou para ativar o alarme.");
                    } else {
                        try {
                            chrome.alarms.create(`task-alert-${id}`, { when: alertTime });
                            t.alarmSet = true;
                            needsUpdate = true;
                        } catch(err) {
                            alert("❌ Erro ao ativar alarme. Você recarregou a extensão?");
                            console.error(err);
                        }
                    }
                }
            }
            return t;
        });
        
        if (needsUpdate) {
            chrome.storage.local.set({tasks}, () => {
                if (typeof loadAllTasks === 'function') loadAllTasks();
            });
        }
    });
};

function updateTaskStatusFromDrag(taskId, newStatus) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === taskId) {
                const oldStatus = t.status;
                t.status = newStatus;

                if (newStatus === 'concluida') {
                    t.completed = true;
                    try { chrome.alarms.clear(`task-alert-${taskId}`); } catch(e){} 
                    t.alarmSet = false;
                    if (t.subtasks) t.subtasks = t.subtasks.map(s => ({ ...s, completed: true }));
                } else {
                    t.completed = false; 
                    if (newStatus === 'em_progresso' && (oldStatus === 'atrasada' || t.dueDate < Date.now())) {
                        t.dueDate = Date.now() + 3600000; 
                    }
                    if (newStatus === 'nova') {
                        t.createdAt = Date.now(); 
                        if (t.dueDate < Date.now()) {
                            t.dueDate = Date.now() + 3600000; 
                        }
                    }
                }
            }
            return t;
        });
        chrome.storage.local.set({tasks}, loadAllTasks);
    });
}

function loadAllSubjectsSelects() {
    chrome.storage.local.get({subjects: []}, (data) => {
        const editSelect = document.getElementById('editTaskSubject');
        const newSelect = document.getElementById('newTaskSubject');
        
        editSelect.innerHTML = '<option value="">Nenhuma matéria</option>'; 
        newSelect.innerHTML = '<option value="">Nenhuma matéria (Opcional)</option>'; 

        data.subjects.forEach(c => {
            const opt1 = document.createElement('option');
            opt1.value = c.name; opt1.textContent = c.name;
            editSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = c.name; opt2.textContent = c.name;
            newSelect.appendChild(opt2);
        });
    });
}

function loadAllTasks() {
    chrome.storage.local.get({tasks: []}, (data) => {
        let tasks = data.tasks;
        let needsUpdate = false;
        const nowTime = Date.now();

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
            const matchText = (task.title && task.title.toLowerCase().includes(searchQuery)) || 
                              (task.description && task.description.toLowerCase().includes(searchQuery)) || 
                              (task.subject && task.subject.toLowerCase().includes(searchQuery));
            const matchStatus = statusFilter === 'todos' || task.status === statusFilter;
            return matchText && matchStatus;
        });

        filteredTasks.forEach(task => {
            const subtasks = task.subtasks || [];
            const totalSubs = subtasks.length;
            const completedSubs = subtasks.filter(s => s.completed || task.completed).length;
            
            let subtasksHTML = '';
            
            if (totalSubs > 0) {
                subtasksHTML = `<div class="subtasks-container" id="sub-cont-${task.id}">`;
                subtasks.forEach(sub => {
                    const isCrossed = sub.completed || task.completed;
                    subtasksHTML += `<div class="subtask-item"><div class="subtask-item-content"><span style="${isCrossed ? 'text-decoration: line-through; color: #9aa0a6;' : ''}">${sub.description}</span></div></div>`;
                });
                subtasksHTML += `</div>`;
            }

            let statusText = 'Nova Tarefa'; let statusClass = 'status-nova';
            if (task.status === 'em_progresso') { statusText = 'Em Progresso'; statusClass = 'status-progresso'; }
            if (task.status === 'atrasada') { statusText = 'Em Atraso'; statusClass = 'status-atrasada'; }
            if (task.completed) { statusText = 'Concluída'; statusClass = 'status-concluida'; }

            const statusBadge = `<div class="status-badge ${statusClass}">${task.status === 'atrasada' ? '🚨' : '⚡'} ${statusText}</div>`;
            const subjectBadge = task.subject ? `<div class="subject-badge">📚 Matéria: ${task.subject}</div>` : '';
            const linkBadge = task.link ? `<a href="${task.link}" target="_blank" class="link-badge" title="${task.link}">🔗 Link</a>` : '';

            // Renderizando o Sino do Alarme
            const alarmIcon = task.alarmSet ? '🔔' : '🔕';
            const alarmClass = task.alarmSet ? 'alarm-active' : 'alarm-inactive';
            const alarmBtn = `<button class="btn-alarm ${alarmClass}" data-id="${task.id}" title="Lembrete (5 min antes)">${alarmIcon}</button>`;

            const li = document.createElement('li');
            li.className = `task-item task-card-${task.status}`;
            li.id = `task-hist-${task.id}`; 
            
            li.setAttribute('draggable', 'true');
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', task.id);
                setTimeout(() => li.classList.add('dragging'), 0);
            });
            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
            });

            li.innerHTML = `
                <div class="badges-container">${statusBadge}${subjectBadge}${linkBadge}</div>
                
                <div class="task-header" style="display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                        <strong style="${task.completed ? 'text-decoration: line-through; color: #9aa0a6;' : ''}; font-size: 15px;">${task.title || 'Sem Título'}</strong>
                        ${task.description ? `<span style="font-size: 13px; color: #5f6368; font-weight: normal; ${task.completed ? 'text-decoration: line-through; color: #9aa0a6;' : ''}">${task.description}</span>` : ''}
                    </div>
                    ${alarmBtn}
                </div>
                
                <small style="color: #80868b; margin-top: 4px;">Entrega: ${new Date(task.dueDate).toLocaleString()}</small>
                
                ${totalSubs > 0 ? `
                <div class="subtask-info-row">
                    <span class="subtask-badge">Subtarefas: ${completedSubs}/${totalSubs}</span>
                    <button class="expand-btn btn-expand-sub" data-id="${task.id}">▼</button>
                </div>
                ` : ''}
                
                ${subtasksHTML}
                
                <div class="controls">
                    ${task.completed ? `<button class="btn-chip" data-id="${task.id}" data-action="reactivate">Reativar</button>` : `<button class="btn-chip primary" data-id="${task.id}" data-action="complete">Concluir</button>`}
                    <button class="btn-chip warning btn-edit" data-id="${task.id}">Editar</button>
                    <button class="btn-chip danger btn-delete" data-id="${task.id}">Excluir</button>
                </div>
            `;

            const columnTarget = document.getElementById(`list-${task.status}`);
            if (columnTarget) columnTarget.appendChild(li);
        });

        // Eventos dos Alarmes e Botões - Com preventDefault para não vazar o click
        document.querySelectorAll('.btn-alarm').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleAlarm(e.currentTarget.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.btn-chip[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const action = e.target.getAttribute('data-action');
                const card = document.getElementById(`task-hist-${id}`);
                if (card) {
                    card.classList.add('moving-out'); 
                    setTimeout(() => changeStatus(id, action === 'complete'), 350); 
                } else {
                    changeStatus(id, action === 'complete');
                }
            });
        });

        document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => openEditModal(e.target.getAttribute('data-id'))));
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                if(!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
                const card = document.getElementById(`task-hist-${id}`);
                if (card) {
                    card.classList.add('black-hole'); 
                    setTimeout(() => deleteTask(id), 500); 
                } else {
                    deleteTask(id);
                }
            });
        });

        document.querySelectorAll('.btn-expand-sub').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const container = document.getElementById(`sub-cont-${id}`);
                if(container) {
                    container.classList.toggle('expanded');
                    e.currentTarget.classList.toggle('rotated');
                }
            });
        });
    });
}

// ======== FUNÇÕES DE ADICIONAR TAREFA ========
function openAddTaskModal() {
    setDefaultNewTaskDateTime();
    const modal = document.getElementById('addTaskModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeAddTaskModal() {
    const modal = document.getElementById('addTaskModal');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
    
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDesc').value = '';
    document.getElementById('newTaskLink').value = '';
    document.getElementById('newTaskSubject').value = '';
}

function setDefaultNewTaskDateTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('newTaskDate').value = `${year}-${month}-${day}`;
    document.getElementById('newTaskTime').value = `${hours}:${minutes}`;
}

function saveNewTask() {
    const titleVal = document.getElementById('newTaskTitle').value.trim();
    const descVal = document.getElementById('newTaskDesc').value.trim();
    const dateVal = document.getElementById('newTaskDate').value;
    const timeVal = document.getElementById('newTaskTime').value;
    const subjectVal = document.getElementById('newTaskSubject').value; 
    const linkVal = document.getElementById('newTaskLink').value.trim(); 
    
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
        alarmSet: false,
        subtasks: []
    };

    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks;
        tasks.push(newTask);
        chrome.storage.local.set({tasks}, () => {
            closeAddTaskModal();
            loadAllTasks();
        });
    });
}

// ======== FUNÇÕES DE EDITAR TAREFA ========
function openEditModal(id) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const task = data.tasks.find(t => t.id === id);
        if(!task) return;
        currentEditingTaskId = id;

        document.getElementById('editTaskTitle').value = task.title || ""; 
        document.getElementById('editTaskDesc').value = task.description || ""; 
        document.getElementById('editTaskSubject').value = task.subject || "";
        document.getElementById('editTaskLink').value = task.link || ""; 

        const d = new Date(task.dueDate);
        document.getElementById('editTaskDate').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        document.getElementById('editTaskTime').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        const subList = document.getElementById('editSubtasksList');
        subList.innerHTML = '';
        if(task.subtasks && task.subtasks.length > 0){
            task.subtasks.forEach(sub => {
                subList.innerHTML += `<div class="edit-subtask-row"><span style="font-size:16px; color:#ccc;">↳</span><input type="text" class="edit-sub-input" data-sub-id="${sub.id}" value="${sub.description}"></div>`;
            });
        } else {
            subList.innerHTML = '<span style="font-size:12px; color:#888;">Nenhuma subtarefa.</span>';
        }

        const modal = document.getElementById('editModal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    });
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; currentEditingTaskId = null; }, 300);
}

function saveEditedTask() {
    if(!currentEditingTaskId) return;
    const newTitle = document.getElementById('editTaskTitle').value.trim();
    const newDesc = document.getElementById('editTaskDesc').value.trim();
    const newSubject = document.getElementById('editTaskSubject').value;
    const newLink = document.getElementById('editTaskLink').value.trim();
    const newDate = document.getElementById('editTaskDate').value;
    const newTime = document.getElementById('editTaskTime').value;

    if (!newTitle || !newDate || !newTime) return alert("Preencha título, data e hora!");

    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === currentEditingTaskId) {
                t.title = newTitle; 
                t.description = newDesc; 
                t.subject = newSubject; 
                t.link = newLink; 
                t.dueDate = new Date(`${newDate}T${newTime}`).getTime();
                
                if (t.status === 'atrasada' && t.dueDate >= Date.now()) t.status = 'em_progresso';
                
                // Atualiza o alarme para a nova data caso ele estivesse ativado!
                if (t.alarmSet) {
                    const alertTime = t.dueDate - (5 * 60 * 1000);
                    if (alertTime > Date.now()) {
                        try { chrome.alarms.create(`task-alert-${t.id}`, { when: alertTime }); } catch(e){}
                    } else {
                        try { chrome.alarms.clear(`task-alert-${t.id}`); } catch(e){}
                        t.alarmSet = false;
                    }
                }

                document.querySelectorAll('.edit-sub-input').forEach(input => {
                    const subTask = t.subtasks.find(s => s.id === input.getAttribute('data-sub-id'));
                    if(subTask) subTask.description = input.value.trim();
                });
            }
            return t;
        });
        chrome.storage.local.set({tasks}, () => { closeEditModal(); loadAllTasks(); });
    });
}

// ======== FUNÇÕES DE SUPORTE (STATUS E DELETAR) ========
function changeStatus(id, status) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => { 
            if (t.id === id) {
                t.completed = status;
                if(status) { 
                    t.status = 'concluida'; 
                    try { chrome.alarms.clear(`task-alert-${id}`); } catch(e){} // Desliga o alarme
                    t.alarmSet = false;
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
    try { chrome.alarms.clear(`task-alert-${id}`); } catch(e){} // Apaga o alarme ao deletar a tarefa
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.filter(t => t.id !== id);
        chrome.storage.local.set({tasks}, loadAllTasks);
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
    loadAllSubjectsSelects(); 
    loadAllTasks(); 
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
        });
    });
}