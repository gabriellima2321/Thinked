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
    // ===================================================

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
                
                // Só anima se estiver soltando em uma coluna diferente
                if (card && card.parentElement.id !== `list-${targetStatus}`) {
                    
                    // TRANSIÇÃO SUAVE: Faz o card "encolher" na coluna original
                    card.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 1, 1)';
                    card.style.transform = 'scale(0.5)';
                    card.style.opacity = '0';
                    
                    // Aguarda 200ms para a animação terminar e move os dados
                    setTimeout(() => {
                        updateTaskStatusFromDrag(taskId, targetStatus);
                    }, 200);
                }
            }
        });
    });
    // ==========================================================

    loadAllTasks();
    loadSubjectsInEditModal();

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
            chrome.storage.local.set({tasks: []}, () => {
                alert("Todas as tarefas foram excluídas com sucesso.");
                loadAllTasks(); 
            });
        }
    });

    document.getElementById('searchInput').addEventListener('input', loadAllTasks);
    document.getElementById('statusFilter').addEventListener('change', loadAllTasks);
    document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveEditedTask);
});

// Lida com as regras de movimento entre colunas
function updateTaskStatusFromDrag(taskId, newStatus) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === taskId) {
                const oldStatus = t.status;
                t.status = newStatus;

                if (newStatus === 'concluida') {
                    t.completed = true;
                    if (t.subtasks) t.subtasks = t.subtasks.map(s => ({ ...s, completed: true }));
                } else {
                    t.completed = false; 
                    
                    // REGRA 1: Se for para Progresso e estiver atrasada, ganha +1 hora.
                    if (newStatus === 'em_progresso' && (oldStatus === 'atrasada' || t.dueDate < Date.now())) {
                        t.dueDate = Date.now() + 3600000; 
                    }
                    
                    // REGRA 2: Se for arrastada para "Nova Tarefa", aceita incondicionalmente
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

function loadSubjectsInEditModal() {
    chrome.storage.local.get({subjects: []}, (data) => {
        const select = document.getElementById('editTaskSubject');
        data.subjects.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name; opt.textContent = c.name;
            select.appendChild(opt);
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
            const matchText = task.description.toLowerCase().includes(searchQuery) || (task.subject && task.subject.toLowerCase().includes(searchQuery));
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

            const li = document.createElement('li');
            li.className = 'task-item';
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
                <div class="task-header"><strong style="${task.completed ? 'text-decoration: line-through; color: #9aa0a6;' : ''}; font-size: 14px;">${task.description}</strong></div>
                <small style="color: #80868b; margin-top: 4px;">Entrega: ${new Date(task.dueDate).toLocaleString()}</small>
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
    });
}

function openEditModal(id) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const task = data.tasks.find(t => t.id === id);
        if(!task) return;
        currentEditingTaskId = id;

        document.getElementById('editTaskDesc').value = task.description;
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

function closeModal() {
    const modal = document.getElementById('editModal');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; currentEditingTaskId = null; }, 300);
}

function saveEditedTask() {
    if(!currentEditingTaskId) return;
    const newDesc = document.getElementById('editTaskDesc').value.trim();
    const newSubject = document.getElementById('editTaskSubject').value;
    const newLink = document.getElementById('editTaskLink').value.trim();
    const newDate = document.getElementById('editTaskDate').value;
    const newTime = document.getElementById('editTaskTime').value;

    if (!newDesc || !newDate || !newTime) return alert("Preencha descrição, data e hora!");

    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => {
            if (t.id === currentEditingTaskId) {
                t.description = newDesc; 
                t.subject = newSubject; 
                t.link = newLink; 
                t.dueDate = new Date(`${newDate}T${newTime}`).getTime();
                if (t.status === 'atrasada' && t.dueDate >= Date.now()) t.status = 'em_progresso';
                document.querySelectorAll('.edit-sub-input').forEach(input => {
                    const subTask = t.subtasks.find(s => s.id === input.getAttribute('data-sub-id'));
                    if(subTask) subTask.description = input.value.trim();
                });
            }
            return t;
        });
        chrome.storage.local.set({tasks}, () => { closeModal(); loadAllTasks(); });
    });
}

function changeStatus(id, status) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.map(t => { 
            if (t.id === id) {
                t.completed = status;
                if(status) { t.status = 'concluida'; if(t.subtasks) t.subtasks = t.subtasks.map(s => ({ ...s, completed: true })); } 
                else { t.status = (t.dueDate < Date.now()) ? 'atrasada' : 'em_progresso'; }
            } 
            return t; 
        });
        chrome.storage.local.set({tasks}, loadAllTasks);
    });
}

function deleteTask(id) {
    chrome.storage.local.get({tasks: []}, (data) => {
        const tasks = data.tasks.filter(t => t.id !== id);
        chrome.storage.local.set({tasks}, loadAllTasks);
    });
}