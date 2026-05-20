chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('task-alert-')) {
        const taskId = alarm.name.replace('task-alert-', '');
        
        chrome.storage.local.get({tasks: []}, (data) => {
            const task = data.tasks.find(t => t.id === taskId);
            
            // Só exibe a notificação se a tarefa existir e não estiver concluída
            if (task && !task.completed) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '../icons/task.png', // Fallback nativo
                    title: '⏳ Tarefa quase em atraso!',
                    message: `A tarefa "${task.title || 'Sem Título'}" entrará em atraso em 5 minutos!`,
                    priority: 2
                });
                
                // Desativa o sino após o alarme tocar
                task.alarmSet = false;
                chrome.storage.local.set({tasks: data.tasks});
            }
        });
    }
});