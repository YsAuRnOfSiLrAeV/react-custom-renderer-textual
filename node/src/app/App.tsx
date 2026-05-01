import React, { useMemo, useState } from "react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
};

export function TodoApp() {
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);

  const remainingCount = useMemo(
    () => todos.filter((t) => !t.done).length,
    [todos]
  );

  function addTodo(raw: string) {
    const next = raw.trim();
    if (!next) return;

    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: next, done: false },
    ]);

    setText("");
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <textual-container id="root">
      <textual-text
        id="header"
        text={`Todos: ${todos.length} (remaining: ${remainingCount})`}
      />

      <textual-input
        id="new-todo-input"
        value={text}
        placeholder="Type a todo and press Enter"
        onChange={({ value }: { value: string }) => setText(value)}
        onSubmit={({ value }: { value: string }) => addTodo(value)}
      />

      <textual-button id="add-btn" label="Add" onPress={() => addTodo(text)} />

      <textual-container id="list">
        {todos.map((t) => (
          <textual-container key={t.id} id={`row-${t.id}`}>
            <textual-text
              id={`todo-${t.id}`}
              text={`${t.done ? "[x]" : "[ ]"} ${t.text}`}
            />

            <textual-button
              id={`toggle-${t.id}`}
              label={t.done ? "Undone" : "Done"}
              onPress={() => toggleTodo(t.id)}
            />

            <textual-button
              id={`delete-${t.id}`}
              label="Delete"
              onPress={() => deleteTodo(t.id)}
            />
          </textual-container>
        ))}
      </textual-container>
    </textual-container>
  );
}