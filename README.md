# Thinked

# 📝 Task Kanban Tracker (Chrome Extension)

Uma extensão leve e poderosa para Google Chrome projetada para aumentar a sua produtividade e organizar seus estudos ou projetos. Gerencie tarefas, crie subtarefas, adicione links úteis e relacione tudo a matérias/disciplinas, tudo isso acessível diretamente pelo **Painel Lateral (Side Panel)** nativo do navegador.

## ✨ Principais Funcionalidades

* **🚀 Painel Lateral (Side Panel):** A extensão não é um popup que some quando você clica fora. Ela se fixa na lateral do seu navegador, permitindo que você leia textos, assista a vídeos e anote suas tarefas simultaneamente.
* **📚 Organização por Matérias:** Crie disciplinas (matérias) personalizadas e vincule-as às suas tarefas para manter seus estudos totalmente categorizados.
* **🔗 Links Vinculados:** Adicione URLs de referência às suas tarefas. Um selo clicável ("🔗 Link") aparece no card para acesso rápido.
* **✅ Subtarefas Embutidas:** Divida grandes trabalhos em até 10 subtarefas práticas com checkboxes interativos.
* **📊 Quadro Kanban Integrado:** Uma página de Histórico dedicada, organizada em colunas visuais: *Novas, Em Progresso, Em Atraso* e *Concluídas*.
* **💾 Backup Local (Importar/Exportar):** Nunca perca seus dados. Exporte todo o seu quadro Kanban em formato `.json` e importe quando precisar.
* **🎨 Animações Modernas:** Transições suaves ao concluir tarefas e um efeito especial linear estilo "buraco negro" ao deletar itens.
* **🗑️ Gerenciamento Rápido:** Edite tarefas a qualquer momento, busque por nome ou matéria, filtre por status e, se necessário, utilize o botão de "Excluir Todas as Tarefas" no menu.

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído utilizando tecnologias puras da web, sem frameworks pesados, garantindo máxima performance:
* **HTML5 & CSS3** (com variáveis, flexbox e keyframes para animações).
* **JavaScript (Vanilla)** para toda a lógica de estado e manipulação do DOM.
* **Chrome Extensions API (Manifest V3)**, utilizando `chrome.storage.local` para salvar dados offline e `chrome.sidePanel` para a interface lateral.

---

## 📦 Como instalar e testar localmente

Como esta extensão ainda não está publicada na Chrome Web Store, você pode instalá-la facilmente usando o Modo do Desenvolvedor:

1. Faça o clone deste repositório ou baixe o arquivo `.zip` e extraia em uma pasta no seu computador:
   ```bash
   git clone [https://github.com/gabriellima2321/Thinked.git]https://github.com/gabriellima2321/Thinked.git)