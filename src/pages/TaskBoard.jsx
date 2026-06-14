import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getTasksByTeam, createTask, updateTaskStatus, deleteTask } from '../services/taskService';
import { getMyTeams } from '../services/teamService';

const COLUMNS = [
  { id: 'todo', label: '📋 To Do', color: '#6b7280' },
  { id: 'inprogress', label: '⚡ In Progress', color: '#f59e0b' },
  { id: 'done', label: '✅ Done', color: '#10b981' },
];

export default function TaskBoard() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', deadline: '' });
  const navigate = useNavigate();

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) loadTasks(selectedTeam.id);
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      const res = await getMyTeams();
      setTeams(res.data);
      if (res.data.length > 0) setSelectedTeam(res.data[0]);
    } catch (err) {
      console.error('Failed to load teams');
    }
  };

  const loadTasks = async (teamId) => {
    try {
      const res = await getTasksByTeam(teamId);
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to load tasks');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await createTask({ ...form, teamId: selectedTeam.id });
      setForm({ title: '', description: '', priority: 'medium', deadline: '' });
      setShowForm(false);
      loadTasks(selectedTeam.id);
    } catch (err) {
      console.error('Failed to create task');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    try {
      await updateTaskStatus(draggableId, newStatus);
      loadTasks(selectedTeam.id);
    } catch (err) {
      console.error('Failed to update status');
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await deleteTask(taskId);
      loadTasks(selectedTeam.id);
    } catch (err) {
      console.error('Failed to delete task');
    }
  };

  const getTasksByStatus = (status) => tasks.filter((t) => t.status === status);

  const priorityColor = (p) => p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#10b981';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Task Board</h2>
        <div style={styles.headerRight}>
          <select
            style={styles.select}
            value={selectedTeam?.id || ''}
            onChange={(e) => setSelectedTeam(teams.find(t => t.id === parseInt(e.target.value)))}>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button style={styles.btnPrimary} onClick={() => setShowForm(!showForm)}>
            + Add Task
          </button>
          <button style={styles.btnBack} onClick={() => navigate('/dashboard')}>
            ← Back
          </button>
        </div>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3>Create New Task</h3>
          <form onSubmit={handleCreateTask}>
            <input
              style={styles.input}
              placeholder="Task Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              style={styles.input}
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <select
              style={styles.input}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">🟢 Low Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="high">🔴 High Priority</option>
            </select>
            <input
              style={styles.input}
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={styles.btnPrimary} type="submit">Create Task</button>
              <button style={styles.btnBack} type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!selectedTeam ? (
        <p style={styles.empty}>No teams found. Create a team first!</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={styles.board}>
            {COLUMNS.map((col) => (
              <div key={col.id} style={styles.column}>
                <div style={{ ...styles.colHeader, borderTop: `4px solid ${col.color}` }}>
                  <span>{col.label}</span>
                  <span style={styles.badge}>{getTasksByStatus(col.id).length}</span>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={styles.colBody}>
                      {getTasksByStatus(col.id).map((task, index) => (
                        <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ ...styles.taskCard, ...provided.draggableProps.style }}>
                              <div style={styles.taskTop}>
                                <span style={{ ...styles.priority, background: priorityColor(task.priority) }}>
                                  {task.priority}
                                </span>
                                <button
                                  style={styles.deleteBtn}
                                  onClick={() => handleDelete(task.id)}>✕</button>
                              </div>
                              <p style={styles.taskTitle}>{task.title}</p>
                              {task.description && <p style={styles.taskDesc}>{task.description}</p>}
                              {task.deadline && <p style={styles.deadline}>📅 {task.deadline}</p>}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '24px', background: '#f0f2f5', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { color: '#333', margin: 0 },
  headerRight: { display: 'flex', gap: '12px', alignItems: 'center' },
  select: { padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' },
  btnPrimary: { padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  btnBack: { padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  formCard: { background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  input: { width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  board: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  column: { flex: 1, background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minHeight: '400px' },
  colHeader: { padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', color: '#333' },
  badge: { background: '#f0f2f5', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' },
  colBody: { padding: '8px', minHeight: '300px' },
  taskCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '8px', cursor: 'grab' },
  taskTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  priority: { color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' },
  deleteBtn: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' },
  taskTitle: { margin: '0 0 4px 0', fontWeight: 'bold', color: '#333', fontSize: '14px' },
  taskDesc: { margin: '0 0 4px 0', color: '#666', fontSize: '12px' },
  deadline: { margin: 0, color: '#9ca3af', fontSize: '11px' },
  empty: { color: '#666', textAlign: 'center', marginTop: '48px' },
};