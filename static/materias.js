document.addEventListener('DOMContentLoaded', () => {
    loadSubjects();

    document.getElementById('addSubjectBtn').addEventListener('click', () => {
        const nameInput = document.getElementById('subjectName');
        const name = nameInput.value.trim();
        if (!name) return alert("Digite um nome para a matéria!");

        chrome.storage.local.get({subjects: []}, (data) => {
            const subjects = data.subjects;
            if(subjects.some(c => c.name.toLowerCase() === name.toLowerCase())) return alert("Matéria já existe.");
            subjects.push({ id: Date.now().toString(), name: name });
            chrome.storage.local.set({subjects}, () => { nameInput.value = ''; loadSubjects(); });
        });
    });
});

function loadSubjects() {
    chrome.storage.local.get({subjects: []}, (data) => {
        const list = document.getElementById('subjectsList');
        list.innerHTML = '';
        if (data.subjects.length === 0) {
            list.innerHTML = '<p style="color: #888; text-align: center; margin-top: 20px;">Nenhuma matéria cadastrada.</p>'; return;
        }

        data.subjects.forEach(subject => {
            const li = document.createElement('li');
            li.className = 'subject-item';
            li.innerHTML = `<strong>${subject.name}</strong><button class="btn-chip danger btn-delete-subject" data-id="${subject.id}">Excluir</button>`;
            list.appendChild(li);
        });

        document.querySelectorAll('.btn-delete-subject').forEach(btn => {
            btn.addEventListener('click', (e) => deleteSubject(e.target.getAttribute('data-id')));
        });
    });
}

function deleteSubject(id) {
    if(!confirm("Deseja excluir esta matéria? Tarefas antigas manterão o nome no histórico.")) return;
    chrome.storage.local.get({subjects: []}, (data) => {
        const subjects = data.subjects.filter(c => c.id !== id);
        chrome.storage.local.set({subjects}, loadSubjects);
    });
}