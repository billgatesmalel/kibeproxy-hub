// ── FEEDBACK PAGE LOGIC ───────────────────────────────────────
let currentUserId = null;
let currentUserName = null;
let feedbacks = [];
let userVotes = {};
let editingId = null; // Track if we are editing an existing review

async function initFeedback() {
  const { data: { session } } = await db.auth.getSession();
  if (session && session.user) {
    currentUserId = session.user.id;
    currentUserName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
  }

  loadFeedbacks();
  initStarRating();
}

// ── STAR RATING UI ────────────────────────────────────────────
function initStarRating() {
  const stars = document.querySelectorAll('#star-input-wrap span');
  const input = document.getElementById('rating-val');

  stars.forEach(s => {
    s.addEventListener('click', () => {
      const val = parseInt(s.getAttribute('data-val'));
      input.value = val;
      updateStars(val);
    });
    s.addEventListener('mouseover', () => updateStars(parseInt(s.getAttribute('data-val'))));
    s.addEventListener('mouseout', () => updateStars(parseInt(input.value)));
  });

  function updateStars(val) {
    stars.forEach(s => {
      s.classList.toggle('selected', parseInt(s.getAttribute('data-val')) <= val);
    });
  }
  updateStars(parseInt(input.value));
}

// ── LOAD FEEDBACKS ────────────────────────────────────────────
async function loadFeedbacks() {
  const reviewsList = document.getElementById('reviews-list');
  
  const [
    { data: feedbackData, error: fbError },
    { data: voteData }
  ] = await Promise.all([
    db.from('feedbacks').select('*').order('created_at', { ascending: false }),
    currentUserId ? db.from('feedback_votes').select('*').eq('user_id', currentUserId) : { data: [] }
  ]);

  if (fbError) {
    reviewsList.innerHTML = `<div class="error">Error loading reviews: ${fbError.message}</div>`;
    return;
  }

  feedbacks = feedbackData || [];
  userVotes = {};
  if (voteData) {
    voteData.forEach(v => userVotes[v.feedback_id] = v.vote_type);
  }

  updateSummary();
  renderFeedbacks();
}

function updateSummary() {
  if (!feedbacks.length) {
    document.getElementById('avg-stars').textContent = '☆☆☆☆☆';
    document.getElementById('avg-text').textContent = 'No reviews yet. Be the first!';
    return;
  }

  const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
  const avg = (sum / feedbacks.length).toFixed(1);
  const stars = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
  
  document.getElementById('avg-stars').textContent = stars;
  document.getElementById('avg-text').textContent = `${avg} / 5.0 based on ${feedbacks.length} review${feedbacks.length === 1 ? '' : 's'}`;
}

function renderFeedbacks() {
  const container = document.getElementById('reviews-list');
  if (!feedbacks.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center;padding:3rem;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p style="color:var(--text-muted);margin-top:1rem;">No reviews yet.</p>
    </div>`;
    return;
  }

  container.innerHTML = feedbacks.map(f => {
    const starString = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
    const date = new Date(f.created_at).toLocaleDateString();
    const userVote = userVotes[f.id];
    const isOwner = f.user_id === currentUserId;

    return `
      <div class="review-card">
        <div class="review-header">
          <div>
            <div class="review-user">${f.user_name || 'Anonymous User'}</div>
            <div class="review-stars">${starString}</div>
          </div>
          <div style="text-align:right;">
             <div class="review-date">${date}</div>
             ${isOwner ? `
               <div style="margin-top:8px;display:flex;gap:10px;justify-content:flex-end;">
                 <button onclick="editFeedback('${f.id}')" style="background:none;border:none;color:var(--blue);font-size:0.75rem;cursor:pointer;padding:0;">Edit</button>
                 <button onclick="deleteFeedback('${f.id}')" style="background:none;border:none;color:var(--red);font-size:0.75rem;cursor:pointer;padding:0;">Delete</button>
               </div>
             ` : ''}
          </div>
        </div>
        <div class="review-content">${f.content}</div>
        
        ${f.admin_reply ? `
          <div class="admin-reply">
            <span class="admin-reply-label">Admin Reply</span>
            <div class="review-content" style="margin-bottom:0;">${f.admin_reply}</div>
          </div>
        ` : ''}

        <div class="review-actions">
          <button class="action-btn ${userVote === 'helpful' ? 'active' : ''}" 
            onclick="vote('${f.id}', 'helpful')" ${!currentUserId ? 'disabled' : ''}>
            👍 Helpful (${f.helpful_count || 0})
          </button>
          <button class="action-btn ${userVote === 'not_helpful' ? 'active' : ''}" 
            onclick="vote('${f.id}', 'not_helpful')" ${!currentUserId ? 'disabled' : ''}>
            👎 Not Helpful (${f.not_helpful_count || 0})
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── VOTE ──────────────────────────────────────────────────────
async function vote(feedbackId, type) {
  if (!currentUserId) { showToast('Please log in to vote', 'error'); return; }
  
  if (userVotes[feedbackId]) {
    showToast('You have already voted on this review', 'error');
    return;
  }

  try {
    // 1. Record the vote to prevent double voting via RLS/Unique constraint
    const { error: vError } = await db.from('feedback_votes').insert([{
      feedback_id: feedbackId,
      user_id: currentUserId,
      vote_type: type
    }]);

    if (vError) throw vError;

    // 2. Increment the count on the feedback record
    const col = type === 'helpful' ? 'helpful_count' : 'not_helpful_count';
    const feedback = feedbacks.find(f => f.id === feedbackId);
    
    const { error: fError } = await db.from('feedbacks')
      .update({ [col]: (feedback[col] || 0) + 1 })
      .eq('id', feedbackId);

    if (fError) throw fError;

    showToast('Thank you for your feedback!');
    loadFeedbacks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── SUBMIT FEEDBACK ───────────────────────────────────────────
function openFeedbackModal() {
  if (!currentUserId) { window.location.href = 'auth.html'; return; }
  editingId = null;
  document.getElementById('feedback-content').value = '';
  document.getElementById('rating-val').value = '5';
  document.querySelector('.modal-title').textContent = 'Share Your Experience';
  document.getElementById('submit-feedback-btn').textContent = 'Submit Review';
  
  // Reset star rating UI to 5
  const stars = document.querySelectorAll('#star-input-wrap span');
  stars.forEach(s => s.classList.add('selected'));
  
  openModal('feedback');
}

function editFeedback(id) {
  const f = feedbacks.find(item => item.id === id);
  if (!f) return;

  editingId = id;
  document.getElementById('feedback-content').value = f.content;
  document.getElementById('rating-val').value = f.rating;
  document.querySelector('.modal-title').textContent = 'Edit Your Review';
  document.getElementById('submit-feedback-btn').textContent = 'Save Changes';

  // Update star rating UI
  const stars = document.querySelectorAll('#star-input-wrap span');
  stars.forEach(s => {
    s.classList.toggle('selected', parseInt(s.getAttribute('data-val')) <= f.rating);
  });

  openModal('feedback');
}

async function deleteFeedback(id) {
  if (!confirm('Are you sure you want to delete your review?')) return;

  const { error } = await db.from('feedbacks').delete().eq('id', id);
  if (error) {
    showToast(error.message, 'error');
  } else {
    showToast('Review deleted successfully');
    loadFeedbacks();
  }
}

async function submitFeedback() {
  const content = document.getElementById('feedback-content').value.trim();
  const rating = parseInt(document.getElementById('rating-val').value);

  const btn = document.getElementById('submit-feedback-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processing...';

  let res;
  if (editingId) {
    // Update existing
    res = await db.from('feedbacks').update({
      rating: rating,
      content: content,
      created_at: new Date().toISOString() // Optional: update date on edit
    }).eq('id', editingId);
  } else {
    // Insert new
    res = await db.from('feedbacks').insert([{
      user_id: currentUserId,
      user_name: currentUserName,
      rating: rating,
      content: content || `Rated ${rating} star${rating !== 1 ? 's' : ''}`
    }]);
  }

  btn.disabled = false;
  btn.textContent = originalText;

  if (res.error) {
    showToast(res.error.message, 'error');
  } else {
    showToast(editingId ? 'Feedback updated!' : 'Feedback submitted! Thank you.');
    closeModal('feedback');
    document.getElementById('feedback-content').value = '';
    editingId = null;
    loadFeedbacks();
  }
}

initFeedback();
