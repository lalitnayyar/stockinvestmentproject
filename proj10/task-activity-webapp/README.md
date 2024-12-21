# Task Activity Web Application

This project is a simple task activity web application built with Node.js, Express, and SQLite. It allows users to create, view, and print a list of tasks, each automatically timestamped upon creation.

## Project Structure

```
task-activity-webapp
├── src
│   ├── app.js                # Entry point of the application
│   ├── controllers           # Contains task-related controllers
│   │   └── taskController.js  # Handles task operations
│   ├── models                # Contains data models
│   │   └── taskModel.js      # Defines task data structure
│   ├── routes                # Contains route definitions
│   │   └── taskRoutes.js     # Maps routes to controller methods
│   ├── views                 # Contains view templates
│   │   └── index.ejs         # Main user interface
│   └── utils                 # Utility functions
│       └── timestamp.js      # Provides current timestamp
├── database
│   └── tasks.db              # SQLite database file
├── package.json              # NPM configuration file
├── README.md                 # Project documentation
└── .gitignore                # Git ignore file
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd task-activity-webapp
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the application:**
   ```
   npm start
   ```

4. **Access the application:**
   Open your web browser and navigate to `http://localhost:3000`.

## Usage

- **Create a Task:** Fill out the form on the main page to add a new task. Each task will be automatically timestamped.
- **View Tasks:** The list of tasks will be displayed on the main page.
- **Print Tasks:** Use the print functionality to print the list of tasks.

## Dependencies

- Express
- SQLite3
- EJS

## License

This project is licensed under the MIT License.