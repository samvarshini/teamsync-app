import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getTasksByTeam, createTask, updateTaskStatus, deleteTask } from '../services/taskService';
import { getMyTeams } from '../services/teamService';
import ThemeToggle from '../components/ThemeToggle';

const COLUMNS = [
  { id: 'todo', label: '📋 To Do', color: 'var(--text-secondary)' },
  { id: 'inprogress', label: '⚡ In Progress', color: 'var(--warning)' },
  { id: 'done', label: '✅ Done', color: 'var(--success)' },
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

  const priorityColor = (p) => p === 'high' ? 'var(--error)' : p === 'medium' ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Task Board</h2>
        <div style={styles.headerRight}>
          <ThemeToggle />
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
  container: { padding: '32px', background: 'transparent', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', marginBottom: '24px', background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '22px', padding: '18px 20px', boxShadow: 'var(--shadow-soft)' },
  title: { color: 'var(--text-primary)', margin: 0, fontSize: '28px' },
  headerRight: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  select: { padding: '11px 14px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '14px' },
  btnPrimary: { padding: '11px 20px', background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))', color: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 14px 30px rgba(var(--primary-accent-rgb),0.24)' },
  btnBack: { padding: '11px 20px', background: 'var(--glass-bg-soft)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', cursor: 'pointer', fontWeight: 700 },
  formCard: { background: 'var(--glass-bg)', color: 'var(--text-primary)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', padding: '24px', borderRadius: '22px', border: '1px solid var(--border-color)', marginBottom: '24px', boxShadow: 'var(--shadow-soft)' },
  input: { width: '100%', padding: '13px 15px', marginBottom: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' },
  board: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))', gap: '24px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '8px' },
  column: { background: 'var(--glass-bg)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--border-color)', borderRadius: '22px', boxShadow: 'var(--shadow-soft)', minHeight: '400px', minWidth: '240px', overflow: 'hidden' },
  colHeader: { padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', color: 'var(--text-primary)', background: 'var(--hover-bg)' },
  badge: { background: 'var(--glass-bg-soft)', color: 'var(--primary-accent)', border: '1px solid var(--border-color)', padding: '3px 9px', borderRadius: '999px', fontSize: '12px' },
  colBody: { padding: '10px', minHeight: '300px' },
  taskCard: { background: 'var(--glass-bg-strong)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '14px', marginBottom: '10px', cursor: 'grab', boxShadow: 'var(--shadow-soft)' },
  taskTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  priority: { color: 'white', fontSize: '10px', padding: '4px 9px', borderRadius: '999px', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.3px' },
  deleteBtn: { background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: '999px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', width: '26px', height: '26px' },
  taskTitle: { margin: '0 0 4px 0', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' },
  taskDesc: { margin: '0 0 4px 0', color: 'var(--text-secondary)', fontSize: '12px' },
  deadline: { margin: 0, color: 'var(--text-muted)', fontSize: '11px' },
  empty: { color: 'var(--text-secondary)', textAlign: 'center', marginTop: '48px' },
};
