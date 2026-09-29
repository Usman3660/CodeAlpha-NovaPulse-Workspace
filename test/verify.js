const http = require('http');

function post(path, data, token = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(path, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method: 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting NovaPulse Automated Verification Suite ---');

  // 1. Test Demo Login
  console.log('1. Testing Demo Login...');
  const loginRes = await post('/auth/demo-login', { email: 'usman@example.com' });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Demo login failed: ${JSON.stringify(loginRes)}`);
  }
  const token = loginRes.data.token;
  console.log('✓ Demo login success for Usman');

  // 2. Fetch Projects
  console.log('2. Fetching Projects for current user...');
  const projRes = await get('/projects', token);
  if (projRes.status !== 200 || !projRes.data.projects.length) {
    throw new Error(`Fetch projects failed: ${JSON.stringify(projRes)}`);
  }
  const projectId = projRes.data.projects[0].id;
  console.log(`✓ Fetched ${projRes.data.projects.length} projects. Active Project ID: ${projectId}`);

  // 3. Fetch Project Details with Columns and Tasks
  console.log('3. Fetching Project Details...');
  const detailsRes = await get(`/projects/${projectId}`, token);
  if (detailsRes.status !== 200 || !detailsRes.data.columns.length) {
    throw new Error(`Fetch project details failed: ${JSON.stringify(detailsRes)}`);
  }
  console.log(`✓ Columns count: ${detailsRes.data.columns.length}, Tasks count: ${detailsRes.data.tasks.length}`);

  // 4. Create New Task
  console.log('4. Creating New Task...');
  const targetColId = detailsRes.data.columns[0].id;
  const taskRes = await post('/tasks', {
    project_id: projectId,
    column_id: targetColId,
    title: 'Automated Test Card: Real-Time Sync',
    description: 'Testing task card creation with checklist and priority',
    priority: 'high',
    due_date: '2026-10-01',
    tags: [{ name: 'Automated', color: '#10b981' }],
    subtasks: ['Setup unit runner', 'Verify socket sync']
  }, token);

  if (taskRes.status !== 201 || !taskRes.data.task) {
    throw new Error(`Task creation failed: ${JSON.stringify(taskRes)}`);
  }
  const taskId = taskRes.data.task.id;
  console.log(`✓ Task created with ID: ${taskId}`);

  // 5. Post Comment on Task
  console.log('5. Posting Comment on Task...');
  const commentRes = await post('/comments', {
    task_id: taskId,
    content: 'Automated test comment: All test criteria passed!'
  }, token);

  if (commentRes.status !== 201 || !commentRes.data.comment) {
    throw new Error(`Comment creation failed: ${JSON.stringify(commentRes)}`);
  }
  console.log('✓ Comment posted successfully');

  // 6. React with Emoji
  console.log('6. Reacting with Emoji...');
  const reactRes = await post(`/comments/${commentRes.data.comment.id}/react`, {
    emoji: '🚀'
  }, token);
  if (reactRes.status !== 200) {
    throw new Error(`Reaction failed: ${JSON.stringify(reactRes)}`);
  }
  console.log('✓ Emoji reaction toggled successfully');

  // 7. Move Task to Done Column
  console.log('7. Moving Task to Done Column...');
  const doneCol = detailsRes.data.columns.find(c => c.name.toLowerCase().includes('done')) || detailsRes.data.columns[1];
  const moveRes = await post('/tasks/move', {
    task_id: taskId,
    target_column_id: doneCol.id,
    new_order_index: 0,
    project_id: projectId
  }, token);

  if (moveRes.status !== 200) {
    throw new Error(`Move task failed: ${JSON.stringify(moveRes)}`);
  }
  console.log('✓ Task moved successfully to column:', doneCol.name);

  // 8. Fetch Notifications
  console.log('8. Fetching Notifications...');
  const notifRes = await get('/notifications', token);
  if (notifRes.status !== 200) {
    throw new Error(`Notifications failed: ${JSON.stringify(notifRes)}`);
  }
  console.log(`✓ Notifications fetched: ${notifRes.data.notifications.length} total, ${notifRes.data.unreadCount} unread`);

  console.log('====================================================');
  console.log('🎉 ALL AUTOMATED VERIFICATION TESTS PASSED (8/8)!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
