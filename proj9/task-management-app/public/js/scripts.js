document.addEventListener('DOMContentLoaded', function() {
    const taskForm = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');

    // Fetch and display tasks on page load
    fetchTasks();

    // Event listener for task form submission
    taskForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const taskInput = document.getElementById('task-input');
        const taskName = taskInput.value.trim();
        if (taskName) {
            createTask(taskName);
            taskInput.value = '';
        }
    });

    // Function to fetch tasks from the server
    function fetchTasks() {
        fetch('/tasks')
            .then(response => response.json())
            .then(tasks => {
                taskList.innerHTML = '';
                tasks.forEach(task => {
                    const li = document.createElement('li');
                    li.textContent = task.name;
                    li.dataset.id = task.id;
                    li.appendChild(createDeleteButton(task.id));
                    taskList.appendChild(li);
                });
            })
            .catch(error => console.error('Error fetching tasks:', error));
    }

    // Function to create a new task
    function createTask(taskName) {
        fetch('/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: taskName })
        })
        .then(response => response.json())
        .then(() => fetchTasks())
        .catch(error => console.error('Error creating task:', error));
    }

    // Function to create a delete button for a task
    function createDeleteButton(taskId) {
        const button = document.createElement('button');
        button.textContent = 'Delete';
        button.addEventListener('click', function() {
            deleteTask(taskId);
        });
        return button;
    }

    // Function to delete a task
    function deleteTask(taskId) {
        fetch(`/tasks/${taskId}`, {
            method: 'DELETE'
        })
        .then(() => fetchTasks())
        .catch(error => console.error('Error deleting task:', error));
    }
});