const app = document.querySelector('#app');
const modalLayer = document.querySelector('#modalLayer');
const modal = modalLayer.querySelector('.modal');
const videoForm = document.querySelector('#videoForm');
const authLayer = document.querySelector('#authLayer');
const paymentLayer = document.querySelector('#paymentLayer');
const paymentEditLayer = document.querySelector('#paymentEditLayer');
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const paymentForm = document.querySelector('#paymentForm');
const paymentEditForm = document.querySelector('#paymentEditForm');
const state = { user: null, categories: [], videos: [], category: '', access: '', search: '', currentVideo: null, progressTimer: null };
const LIMITS = { titleMin: 3, titleMax: 180, descriptionMax: 4000, durationMax: 86400, videoBytes: 250 * 1024 * 1024, thumbnailBytes: 10 * 1024 * 1024 };
const pagePath = window.location.pathname;
const APP_BASE = pagePath.endsWith('/') ? pagePath.slice(0, -1) : pagePath.slice(0, pagePath.lastIndexOf('/'));
const withContext = value => {
  const url = String(value || '');
  return url.startsWith('/') ? `${APP_BASE}${url}` : url;
};

const api = async (url, options = {}) => {
  const response = await fetch(withContext(url), options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Request failed'); error.status = response.status; throw error; }
  return data;
};

function updateAccountUi() {
  const user = state.user;
  document.querySelector('#authActions').hidden = !!user;
  document.querySelector('#profileButton').hidden = !user;
  document.querySelector('#uploadButton').hidden = !user || user.role !== 'CREATOR';
  const studioLink = document.querySelector('[data-nav="studio"]');
  if (studioLink) studioLink.hidden = !user || user.role !== 'CREATOR';
  if (user) {
    document.querySelector('#profileName').textContent = user.displayName;
    document.querySelector('#profileRole').textContent = user.premium ? `${user.role === 'CREATOR' ? 'Creator' : 'Viewer'} · Premium` : (user.role === 'CREATOR' ? 'Creator' : 'Viewer');
    document.querySelector('#profileAvatar').textContent = user.displayName.trim().charAt(0).toUpperCase();
  }
}

function showAuth(tab = 'login') {
  authLayer.hidden = false; document.body.style.overflow = 'hidden'; setAuthTab(tab);
}
function closeAuth() { authLayer.hidden = true; document.body.style.overflow = ''; }
function setAuthTab(tab) {
  const login = tab === 'login';
  loginForm.hidden = !login; registerForm.hidden = login;
  document.querySelector('#authTitle').textContent = login ? 'Sign in' : 'Create your account';
  document.querySelectorAll('[data-auth-tab]').forEach(button => button.classList.toggle('active', button.dataset.authTab === tab));
  setTimeout(() => (login ? loginForm.elements.identifier : registerForm.elements.displayName).focus(), 30);
}
function showPayment() {
  if (!state.user) { showAuth('login'); toast('Sign in before choosing a plan'); return; }
  paymentLayer.hidden = false; document.body.style.overflow = 'hidden';
  setTimeout(() => paymentForm.elements.cardholder.focus(), 30);
}
function closePayment() { paymentLayer.hidden = true; document.body.style.overflow = ''; }
async function showPaymentEdit(id) {
  const payment = await api(`/api/payments/${id}`);
  paymentEditForm.reset();
  paymentEditForm.elements.paymentId.value = payment.id;
  paymentEditForm.elements.plan.value = payment.plan;
  paymentEditForm.elements.status.value = payment.status;
  paymentEditLayer.hidden = false; document.body.style.overflow = 'hidden';
  setTimeout(() => paymentEditForm.elements.plan.focus(), 30);
}
function closePaymentEdit() { paymentEditLayer.hidden = true; document.body.style.overflow = ''; }
function signedInOrPrompt() { if (state.user) return true; showAuth('login'); toast('Please sign in to continue'); return false; }

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDuration = seconds => {
  seconds = Number(seconds) || 0;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
};
const fmtViews = n => new Intl.NumberFormat('en', { notation: Number(n) > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(n) || 0);
const relativeDate = value => {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value)) / 86400000));
  if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
};
const toast = (message, error = false) => {
  const item = document.createElement('div'); item.className = `toast${error ? ' error' : ''}`; item.textContent = message;
  document.querySelector('#toasts').append(item); setTimeout(() => item.remove(), 3600);
};
const loading = () => { app.innerHTML = '<div class="page-loading"><span class="spinner"></span>Loading…</div>'; };
const emptyCard = (icon, title, text) => `<div class="empty-card"><span class="material-symbols-outlined">${icon}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;

const isHttpUrl = value => {
  try { const url = new URL(value); return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
};
const hasExtension = (file, extensions) => extensions.some(extension => file.name.toLowerCase().endsWith(extension));
const formError = (message, element) => {
  if (element && element.type !== 'file') {
    element.focus(); element.setCustomValidity(message); element.reportValidity();
    element.addEventListener('input', () => element.setCustomValidity(''), {once:true});
  }
  throw new Error(message);
};
function validateVideoForm(isEdit) {
  if (!videoForm.reportValidity()) return false;
  const title = videoForm.elements.title.value.trim();
  const description = videoForm.elements.description.value.trim();
  const categoryId = Number(videoForm.elements.categoryId.value);
  const duration = Number(videoForm.elements.durationSeconds.value);
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) formError('Title must be between 3 and 180 characters.', videoForm.elements.title);
  if (description.length > LIMITS.descriptionMax) formError('Description must be 4000 characters or fewer.', videoForm.elements.description);
  if (!Number.isInteger(categoryId) || categoryId <= 0) formError('Select a valid category.', videoForm.elements.categoryId);
  if (!Number.isInteger(duration) || duration < 1 || duration > LIMITS.durationMax) formError('Duration must be between 1 and 86400 seconds.', videoForm.elements.durationSeconds);

  if (isEdit) {
    for (const input of [videoForm.elements.editVideoUrl, videoForm.elements.editThumbnailUrl]) {
      const value = input.value.trim();
      if (value && !isHttpUrl(value)) formError('Enter a valid HTTP or HTTPS URL.', input);
    }
    return true;
  }

  const videoFile = videoForm.elements.videoFile.files[0];
  const thumbnailFile = videoForm.elements.thumbnailFile.files[0];
  const videoUrl = videoForm.elements.videoUrl.value.trim();
  const thumbnailUrl = videoForm.elements.thumbnailUrl.value.trim();
  if (!videoFile && !videoUrl) formError('Choose a video file or enter a video URL.', videoForm.elements.videoUrl);
  if (!thumbnailFile && !thumbnailUrl) formError('Choose a thumbnail or enter a thumbnail URL.', videoForm.elements.thumbnailUrl);
  if (videoUrl && !isHttpUrl(videoUrl)) formError('Video URL must use HTTP or HTTPS.', videoForm.elements.videoUrl);
  if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) formError('Thumbnail URL must use HTTP or HTTPS.', videoForm.elements.thumbnailUrl);
  if (videoFile && (videoFile.size === 0 || videoFile.size > LIMITS.videoBytes)) formError('Video file must be non-empty and 250 MB or smaller.', videoForm.elements.videoFile);
  if (videoFile && !hasExtension(videoFile, ['.mp4','.webm','.ogg','.mov'])) formError('Video must be MP4, WebM, OGG, or MOV.', videoForm.elements.videoFile);
  if (thumbnailFile && (thumbnailFile.size === 0 || thumbnailFile.size > LIMITS.thumbnailBytes)) formError('Thumbnail file must be non-empty and 10 MB or smaller.', videoForm.elements.thumbnailFile);
  if (thumbnailFile && !hasExtension(thumbnailFile, ['.jpg','.jpeg','.png','.webp'])) formError('Thumbnail must be JPG, PNG, or WebP.', videoForm.elements.thumbnailFile);
  return true;
}

function videoCard(v, progress = v.lastPosition || 0) {
  const percent = v.durationSeconds ? Math.min(100, Math.round(progress / v.durationSeconds * 100)) : 0;
  return `<article class="video-card" data-watch="${v.id}" tabindex="0">
    <div class="thumb"><img src="${escapeHtml(withContext(v.thumbnailUrl))}" alt="" loading="lazy">
      <span class="badge ${String(v.accessType || 'FREE').toLowerCase()}" style="position:absolute;left:8px;top:8px">${escapeHtml(v.accessType || 'FREE')}</span>
      <span class="duration">${fmtDuration(v.durationSeconds)}</span><div class="play-hover"><span class="material-symbols-outlined">play_arrow</span></div>
      ${percent ? `<div class="progress"><i style="width:${percent}%"></i></div>` : ''}
    </div>
    <div class="card-body"><h3 class="card-title">${escapeHtml(v.title)}</h3>
      <div class="card-meta"><span>${escapeHtml(v.category || '')}</span><span>${fmtViews(v.viewCount)} views</span></div>
    </div></article>`;
}

async function ensureCategories() {
  if (!state.categories.length) state.categories = await api('/api/categories');
  document.querySelector('#formCategory').innerHTML = state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function renderHome() {
  loading();
  await ensureCategories();
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('category', state.category);
  if (state.access) params.set('access', state.access);
  const [videos, history] = await Promise.all([api(`/api/videos?${params}`), state.user ? api('/api/history') : Promise.resolve([])]);
  state.videos = videos;
  const hero = videos[0];
  app.innerHTML = `<div class="page">
    <div class="chips" aria-label="Video filters">
      <button class="chip ${!state.category && !state.access ? 'active' : ''}" data-filter="all">All videos</button>
      <button class="chip ${state.access === 'FREE' ? 'active' : ''}" data-access="FREE">Free</button>
      <button class="chip ${state.access === 'PREMIUM' ? 'active' : ''}" data-access="PREMIUM">Premium</button>
      ${state.categories.map(c => `<button class="chip ${String(state.category) === String(c.id) ? 'active' : ''}" data-category="${c.id}">${escapeHtml(c.name)}</button>`).join('')}
    </div>
    ${hero ? `<section class="hero" style="background-image:url('${escapeHtml(withContext(hero.thumbnailUrl)).replace(/'/g,'%27')}')">
      <div class="hero-content"><div class="badges"><span class="badge ${hero.accessType.toLowerCase()}">${hero.accessType}</span><span class="badge">${escapeHtml(hero.category)}</span><span class="badge">${fmtDuration(hero.durationSeconds)}</span></div>
      <h1>${escapeHtml(hero.title)}</h1><p>${escapeHtml(hero.description)}</p>
      <div class="hero-creator"><img src="${escapeHtml(withContext(hero.creatorAvatar))}" alt=""><strong>${escapeHtml(hero.creatorName)}</strong><span class="material-symbols-outlined" style="color:var(--primary);font-size:17px">verified</span></div>
      <div class="hero-actions"><button class="button primary" data-watch="${hero.id}"><span class="material-symbols-outlined">play_arrow</span>Watch now</button><button class="button secondary" data-save="${hero.id}"><span class="material-symbols-outlined">${hero.saved ? 'bookmark_added':'bookmark_add'}</span><span>${hero.saved ? 'Saved':'Watchlist'}</span></button></div>
      </div></section>` : ''}
    ${history.length ? `<section><div class="section-head"><div><h2>Continue watching</h2><p>Pick up where you left off</p></div><a class="text-link" href="#history">View history</a></div><div class="video-grid">${history.slice(0,4).map(v => videoCard({...v, accessType:'FREE', viewCount:''}, v.lastPosition)).join('')}</div></section>` : ''}
    <section><div class="section-head"><div><h2>${state.search ? `Results for “${escapeHtml(state.search)}”` : 'Videos for you'}</h2><p>${videos.length} video${videos.length === 1 ? '' : 's'} available</p></div></div>
      <div class="video-grid">${videos.length ? videos.map(v => videoCard(v)).join('') : emptyCard('search_off','No videos found','Try another search or remove a filter.')}</div>
    </section></div>`;
}

async function renderWatch(id) {
  loading();
  const [video, comments] = await Promise.all([api(`/api/videos/${id}`), api(`/api/videos/${id}/comments`)]);
  state.currentVideo = video;
  const playerContent = video.canWatch
    ? `<video class="player" id="player" controls playsinline poster="${escapeHtml(withContext(video.thumbnailUrl))}" preload="metadata"><source src="${escapeHtml(withContext(video.videoUrl))}"></video>`
    : `<section class="premium-gate" style="background-image:url('${escapeHtml(withContext(video.thumbnailUrl)).replace(/'/g,'%27')}')"><div><span class="material-symbols-outlined">lock</span><h2>Premium video</h2><p>Subscribe to Skopia Premium to watch this video and the complete premium library.</p><button class="button primary" data-action="subscribe">View plans</button></div></section>`;
  const commentForm = state.user ? `<form class="comment-form" id="commentForm"><span class="avatar-fallback">${escapeHtml(state.user.displayName.charAt(0).toUpperCase())}</span><textarea name="text" rows="2" maxlength="1000" required placeholder="Add a comment..."></textarea><button aria-label="Post comment"><span class="material-symbols-outlined">send</span></button></form>` : `<button class="button secondary sign-in-comment" data-action="login">Sign in to comment</button>`;
  app.innerHTML = `<div class="page"><div class="watch-layout"><div>
    ${playerContent}
    <section class="watch-info"><div class="badges"><span class="badge ${video.accessType.toLowerCase()}">${video.accessType}</span><span class="badge">${escapeHtml(video.category)}</span></div><h1>${escapeHtml(video.title)}</h1>
      <div class="watch-meta-row"><div class="creator-info"><img src="${escapeHtml(withContext(video.creatorAvatar))}" alt=""><div><strong>${escapeHtml(video.creatorName)}</strong><small>Content creator</small></div></div>
      <div class="video-actions"><button class="action-button ${video.liked?'active':''}" data-like="${video.id}"><span class="material-symbols-outlined">thumb_up</span><span data-like-count>${fmtViews(video.likeCount)}</span></button><button class="action-button ${video.saved?'active':''}" data-save="${video.id}"><span class="material-symbols-outlined">bookmark</span><span>${video.saved?'Saved':'Save'}</span></button><button class="action-button" data-share="${video.id}"><span class="material-symbols-outlined">share</span>Share</button></div></div>
      <div class="watch-description"><div class="stats">${fmtViews(video.viewCount)} views · ${relativeDate(video.uploadedAt)}</div><div>${escapeHtml(video.description)}</div></div>
    </section></div>
    <aside class="comments-panel"><h2>${comments.length} Comment${comments.length === 1 ? '' : 's'}</h2>
      ${commentForm}
      <div id="comments">${commentsHtml(comments)}</div></aside>
  </div></div>`;
  if (video.canWatch) {
    setupPlayer(video);
    api(`/api/videos/${id}/view`, { method:'POST' }).catch(() => {});
  }
  document.querySelector('#commentForm')?.addEventListener('submit', postComment);
}

function commentsHtml(comments) {
  return comments.length ? comments.map(c => `<div class="comment">${c.avatarUrl ? `<img src="${escapeHtml(withContext(c.avatarUrl))}" alt="">` : `<span class="avatar-fallback">${escapeHtml(c.displayName.charAt(0).toUpperCase())}</span>`}<div class="comment-body"><div class="comment-head"><strong>${escapeHtml(c.displayName)}</strong><time>${relativeDate(c.postedAt)}</time></div><p>${escapeHtml(c.text)}</p>${state.user && Number(c.userId) === Number(state.user.id) ? `<button class="comment-delete" data-delete-comment="${c.id}">Delete</button>`:''}</div></div>`).join('') : '<p style="color:var(--muted);font-size:12px">Be the first to comment.</p>';
}

function setupPlayer(video) {
  const player = document.querySelector('#player');
  let lastSaved = -10;
  player.addEventListener('loadedmetadata', () => { if (video.lastPosition > 0 && video.lastPosition < player.duration - 5) player.currentTime = video.lastPosition; });
  player.addEventListener('timeupdate', () => {
    if (player.currentTime - lastSaved >= 10) { lastSaved = player.currentTime; saveProgress(video.id, player.currentTime, false); }
  });
  player.addEventListener('ended', () => saveProgress(video.id, player.duration, true));
}
function saveProgress(id, position, completed) {
  return api(`/api/videos/${id}/progress`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({position:Math.floor(position),completed}) }).catch(() => {});
}

async function postComment(event) {
  event.preventDefault(); const form = event.currentTarget; const text = form.elements.text.value.trim();
  if (!text) { toast('Comment cannot be empty.', true); form.elements.text.focus(); return; }
  if (text.length > 1000) { toast('Comment must be 1000 characters or fewer.', true); form.elements.text.focus(); return; }
  try { await api(`/api/videos/${state.currentVideo.id}/comments`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})}); form.reset(); const comments = await api(`/api/videos/${state.currentVideo.id}/comments`); document.querySelector('#comments').innerHTML = commentsHtml(comments); document.querySelector('.comments-panel h2').textContent = `${comments.length} Comment${comments.length === 1?'':'s'}`; toast('Comment posted'); }
  catch (e) { toast(e.message, true); }
}

async function renderCollection(type) {
  if (!state.user) {
    app.innerHTML = `<div class="empty-state"><div><span class="material-symbols-outlined">lock</span><h2>Sign in to view your library</h2><p>Your watchlist and history are saved to your account.</p><button class="button primary" data-action="login">Sign in</button></div></div>`;
    return;
  }
  loading(); const items = await api(type === 'history' ? '/api/history' : '/api/watchlist');
  const title = type === 'history' ? 'Watch history' : 'Your watchlist';
  const subtitle = type === 'history' ? 'Continue videos you recently watched.' : 'Videos you saved to watch later.';
  app.innerHTML = `<div class="page"><div class="page-title"><div><span class="eyebrow">Your library</span><h1>${title}</h1><p>${subtitle}</p></div></div><div class="video-grid">${items.length ? items.map(v => videoCard({...v,accessType:'FREE',viewCount:v.viewCount || ''},v.lastPosition)).join('') : emptyCard(type === 'history'?'history':'bookmark','Nothing here yet',type === 'history'?'Start watching a video to build your history.':'Save a video and it will appear here.')}</div></div>`;
}

async function renderStudio() {
  if (!state.user || state.user.role !== 'CREATOR') {
    app.innerHTML = `<div class="empty-state"><div><h2>Creator account required</h2><p>Create or sign in to a creator account to manage videos.</p><button class="button primary" data-action="${state.user ? 'account' : 'register'}">${state.user ? 'View account' : 'Create account'}</button></div></div>`;
    return;
  }
  loading(); await ensureCategories(); const videos = await api('/api/videos?scope=mine'); state.videos = videos;
  app.innerHTML = `<div class="page"><div class="page-title"><div><span class="eyebrow">Content management</span><h1>Creator Studio</h1><p>Upload, edit, publish, and delete your videos.</p></div><button class="button primary" data-action="open-upload"><span class="material-symbols-outlined">add</span>Upload video</button></div>
    <div class="studio-list">${videos.length ? videos.map(v => `<article class="studio-item"><img src="${escapeHtml(withContext(v.thumbnailUrl))}" alt=""><div><div class="badges"><span class="badge ${v.accessType.toLowerCase()}">${v.accessType}</span><span class="badge">${v.status}</span></div><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.category)} · ${fmtViews(v.viewCount)} views · ${relativeDate(v.uploadedAt)}</p></div><div class="studio-actions"><button class="icon-btn" title="Preview" data-watch="${v.id}"><span class="material-symbols-outlined">play_arrow</span></button><button class="icon-btn" title="Edit" data-edit="${v.id}"><span class="material-symbols-outlined">edit</span></button><button class="icon-btn" title="Delete" data-delete-video="${v.id}"><span class="material-symbols-outlined">delete</span></button></div></article>`).join('') : emptyCard('video_library','No uploaded videos','Upload your first video to get started.')}</div></div>`;
}

async function renderAccount() {
  if (!state.user) { showAuth('login'); location.hash = 'home'; return; }
  const [subscription, payments] = await Promise.all([api('/api/payments/status'), api('/api/payments')]);
  const premiumText = subscription.active ? `Active until ${new Date(subscription.periodEnd).toLocaleDateString()}` : 'Free account';
  const paymentHistory = payments.length ? payments.map(payment => `<article class="payment-item">
    <div class="payment-icon"><span class="material-symbols-outlined">credit_card</span></div>
    <div class="payment-details"><div><strong>${escapeHtml(payment.plan)} plan</strong><span class="payment-status ${payment.status.toLowerCase()}">${escapeHtml(payment.status)}</span></div><small>${escapeHtml(payment.cardBrand || 'Card')} ending ${escapeHtml(payment.cardLast4 || '----')} · ${new Date(payment.createdAt).toLocaleDateString()}</small><code>${escapeHtml(payment.reference)}</code></div>
    <strong class="payment-amount">${new Intl.NumberFormat(undefined,{style:'currency',currency:payment.currency}).format(Number(payment.amount))}</strong>
    <div class="studio-actions"><button class="icon-btn" title="Edit payment" data-edit-payment="${payment.id}"><span class="material-symbols-outlined">edit</span></button><button class="icon-btn" title="Delete payment" data-delete-payment="${payment.id}"><span class="material-symbols-outlined">delete</span></button></div>
  </article>`).join('') : emptyCard('receipt_long','No payments yet','Your completed checkout records will appear here.');
  app.innerHTML = `<div class="page account-page"><div class="page-title"><div><span class="eyebrow">Your account</span><h1>${escapeHtml(state.user.displayName)}</h1><p>@${escapeHtml(state.user.username)} · ${escapeHtml(state.user.email)}</p></div></div>
    <div class="account-grid"><section class="account-card"><span class="material-symbols-outlined">person</span><h2>Profile</h2><dl><div><dt>Account type</dt><dd>${state.user.role === 'CREATOR' ? 'Creator' : 'Viewer'}</dd></div><div><dt>Member since</dt><dd>${new Date(state.user.createdAt).toLocaleDateString()}</dd></div></dl></section>
    <section class="account-card premium-card"><span class="material-symbols-outlined">workspace_premium</span><h2>Skopia Premium</h2><p>${premiumText}</p>${subscription.active ? `<span class="status-pill">${escapeHtml(subscription.plan)} plan</span>` : '<button class="button primary" data-action="subscribe">Choose a plan</button>'}</section></div>
    <section class="payment-history"><div class="section-head"><div><h2>Payment history</h2><p>Create, review, update, or remove your demo payment records.</p></div><button class="button secondary" data-action="subscribe"><span class="material-symbols-outlined">add</span>New payment</button></div><div class="payment-list">${paymentHistory}</div></section>
    <button class="button danger" data-action="logout"><span class="material-symbols-outlined">logout</span>Sign out</button></div>`;
}

async function route() {
  document.querySelector('#sidebar').classList.remove('open');
  const hash = location.hash.slice(1) || 'home'; const [page,id] = hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === page || (page === 'watch' && a.dataset.nav === 'home')));
  try {
    if (page === 'watch' && id) await renderWatch(id);
    else if (page === 'history' || page === 'watchlist') await renderCollection(page);
    else if (page === 'studio') await renderStudio();
    else if (page === 'account') await renderAccount();
    else await renderHome();
    app.focus({preventScroll:true}); window.scrollTo(0,0);
  } catch (e) { app.innerHTML = `<div class="empty-state"><div><h2>Could not load this page</h2><p>${escapeHtml(e.message)}</p><button class="button primary" onclick="location.reload()">Try again</button></div></div>`; }
}

async function toggleLike(id, button) {
  if (!signedInOrPrompt()) return;
  try { const result = await api(`/api/videos/${id}/like`,{method:'POST'}); button.classList.toggle('active',result.active); button.querySelector('[data-like-count]').textContent=fmtViews(result.count); }
  catch(e){toast(e.message,true)}
}
async function toggleSave(id, button) {
  if (!signedInOrPrompt()) return;
  try { const result=await api(`/api/videos/${id}/save`,{method:'POST'}); button.classList.toggle('active',result.active); const icon=button.querySelector('.material-symbols-outlined'); if(icon) icon.textContent=result.active?'bookmark_added':'bookmark_add'; const text=[...button.children].find(x=>x.tagName==='SPAN'&&!x.classList.contains('material-symbols-outlined')); if(text) text.textContent=result.active?'Saved':'Save'; toast(result.active?'Saved to watchlist':'Removed from watchlist'); }
  catch(e){toast(e.message,true)}
}

async function openVideoModal(video = null) {
  if (!state.user || state.user.role !== 'CREATOR') { toast('A creator account is required', true); return; }
  await ensureCategories(); videoForm.reset(); modal.classList.toggle('edit-mode',!!video); modalLayer.hidden=false; document.body.style.overflow='hidden';
  document.querySelector('#modalTitle').textContent=video?'Edit video':'Upload a video'; document.querySelector('#formSubmit').innerHTML=`<span class="material-symbols-outlined">${video?'save':'cloud_upload'}</span>${video?'Save changes':'Publish video'}`;
  if(video){ videoForm.elements.videoId.value=video.id; videoForm.elements.title.value=video.title; videoForm.elements.description.value=video.description; videoForm.elements.categoryId.value=video.categoryId; videoForm.elements.accessType.value=video.accessType; videoForm.elements.status.value=video.status; videoForm.elements.durationSeconds.value=video.durationSeconds; }
  setTimeout(()=>videoForm.elements.title.focus(),50);
}
function closeModal(){modalLayer.hidden=true;document.body.style.overflow='';}

videoForm.addEventListener('submit',async event=>{
  event.preventDefault(); const submit=document.querySelector('#formSubmit'); const id=videoForm.elements.videoId.value;
  try{
    if(!validateVideoForm(!!id)) return;
    submit.disabled=true;
    if(id){ const data={title:videoForm.elements.title.value.trim(),description:videoForm.elements.description.value.trim(),categoryId:Number(videoForm.elements.categoryId.value),durationSeconds:Number(videoForm.elements.durationSeconds.value),accessType:videoForm.elements.accessType.value,status:videoForm.elements.status.value,videoUrl:videoForm.elements.editVideoUrl.value.trim(),thumbnailUrl:videoForm.elements.editThumbnailUrl.value.trim()}; await api(`/api/videos/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); toast('Video updated'); }
    else { const data=new FormData(videoForm); data.set('title',videoForm.elements.title.value.trim()); data.set('description',videoForm.elements.description.value.trim()); await api('/api/videos',{method:'POST',body:data}); toast('Video published'); }
    closeModal(); location.hash='studio'; await renderStudio();
  }catch(e){toast(e.message,true)}finally{submit.disabled=false}
});

document.addEventListener('click',async event=>{
  const watch=event.target.closest('[data-watch]'); if(watch){location.hash=`watch/${watch.dataset.watch}`;return}
  const authTab=event.target.closest('[data-auth-tab]'); if(authTab){setAuthTab(authTab.dataset.authTab);return}
  const action=event.target.closest('[data-action]');
  if(action?.dataset.action==='login'){showAuth('login');return}
  if(action?.dataset.action==='register'){showAuth('register');return}
  if(action?.dataset.action==='close-auth'){closeAuth();return}
  if(action?.dataset.action==='subscribe'){showPayment();return}
  if(action?.dataset.action==='close-payment'){closePayment();return}
  if(action?.dataset.action==='close-payment-edit'){closePaymentEdit();return}
  if(action?.dataset.action==='account'){location.hash='account';return}
  if(action?.dataset.action==='logout'){
    try { await api('/api/auth/logout',{method:'POST'}); state.user=null; updateAccountUi(); location.hash='home'; await route(); toast('Signed out'); }
    catch(e){toast(e.message,true)} return;
  }
  if(action?.dataset.action==='open-upload'){openVideoModal();return} if(action?.dataset.action==='close-modal'){closeModal();return}
  const category=event.target.closest('[data-category]'); if(category){state.category=category.dataset.category;state.access='';renderHome();return}
  const access=event.target.closest('[data-access]'); if(access){state.access=access.dataset.access;state.category='';renderHome();return}
  if(event.target.closest('[data-filter="all"]')){state.category='';state.access='';renderHome();return}
  const like=event.target.closest('[data-like]'); if(like){toggleLike(like.dataset.like,like);return}
  const save=event.target.closest('[data-save]'); if(save){toggleSave(save.dataset.save,save);return}
  const share=event.target.closest('[data-share]'); if(share){try{await navigator.clipboard.writeText(location.href);toast('Video link copied')}catch{toast('Could not copy link',true)}return}
  const edit=event.target.closest('[data-edit]'); if(edit){const video=await api(`/api/videos/${edit.dataset.edit}`);openVideoModal(video);return}
  const editPayment=event.target.closest('[data-edit-payment]'); if(editPayment){try{await showPaymentEdit(editPayment.dataset.editPayment)}catch(e){toast(e.message,true)}return}
  const deletePayment=event.target.closest('[data-delete-payment]'); if(deletePayment&&confirm('Delete this payment record? This cannot be undone.')){try{await api(`/api/payments/${deletePayment.dataset.deletePayment}`,{method:'DELETE'});state.user=(await api('/api/auth/me')).user;updateAccountUi();toast('Payment deleted');await renderAccount()}catch(e){toast(e.message,true)}return}
  const del=event.target.closest('[data-delete-video]'); if(del&&confirm('Delete this video permanently?')){try{await api(`/api/videos/${del.dataset.deleteVideo}`,{method:'DELETE'});toast('Video deleted');renderStudio()}catch(e){toast(e.message,true)}return}
  const comment=event.target.closest('[data-delete-comment]'); if(comment&&confirm('Delete your comment?')){try{await api(`/api/comments/${comment.dataset.deleteComment}`,{method:'DELETE'});comment.closest('.comment').remove();toast('Comment deleted')}catch(e){toast(e.message,true)}}
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!loginForm.reportValidity()) return;
  const submit = loginForm.querySelector('[type="submit"]'); submit.disabled = true;
  try {
    const result = await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:loginForm.elements.identifier.value.trim(),password:loginForm.elements.password.value})});
    state.user=result.user; updateAccountUi(); closeAuth(); loginForm.reset(); toast(`Welcome back, ${state.user.displayName}`); await route();
  } catch(e){toast(e.message,true)} finally{submit.disabled=false}
});

registerForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!registerForm.reportValidity()) return;
  const password=registerForm.elements.password.value;
  if(password.length<8||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)){toast('Password needs uppercase, lowercase, and a number',true);return}
  if(password!==registerForm.elements.confirmPassword.value){toast('Passwords do not match',true);registerForm.elements.confirmPassword.focus();return}
  const submit=registerForm.querySelector('[type="submit"]'); submit.disabled=true;
  try {
    const payload={displayName:registerForm.elements.displayName.value.trim(),username:registerForm.elements.username.value.trim(),email:registerForm.elements.email.value.trim(),password,role:registerForm.elements.role.value};
    const result=await api('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    state.user=result.user; updateAccountUi(); closeAuth(); registerForm.reset(); toast('Your account is ready'); await route();
  }catch(e){toast(e.message,true)}finally{submit.disabled=false}
});

paymentForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!paymentForm.reportValidity()) return;
  const submit=paymentForm.querySelector('[type="submit"]'); submit.disabled=true;
  try {
    const payload={plan:paymentForm.elements.plan.value,cardholder:paymentForm.elements.cardholder.value.trim(),cardNumber:paymentForm.elements.cardNumber.value,expiry:paymentForm.elements.expiry.value,cvv:paymentForm.elements.cvv.value};
    await api('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    state.user=(await api('/api/auth/me')).user; updateAccountUi(); closePayment(); paymentForm.reset(); toast('Premium is now active'); await route();
  }catch(e){toast(e.message,true)}finally{submit.disabled=false}
});

paymentEditForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!paymentEditForm.reportValidity()) return;
  const id = paymentEditForm.elements.paymentId.value;
  const plan = paymentEditForm.elements.plan.value;
  const status = paymentEditForm.elements.status.value;
  if (!/^\d+$/.test(id) || Number(id) < 1) { toast('Invalid payment ID', true); return; }
  if (!['MONTHLY','YEARLY'].includes(plan) || !['SUCCEEDED','REFUNDED'].includes(status)) { toast('Choose valid payment values', true); return; }
  const submit=paymentEditForm.querySelector('[type="submit"]'); submit.disabled=true;
  try {
    await api(`/api/payments/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,status})});
    state.user=(await api('/api/auth/me')).user; updateAccountUi(); closePaymentEdit(); toast('Payment updated'); await renderAccount();
  } catch(e){toast(e.message,true)} finally{submit.disabled=false}
});

paymentForm.elements.cardNumber.addEventListener('input', event => { event.target.value=event.target.value.replace(/\D/g,'').slice(0,19).replace(/(.{4})/g,'$1 ').trim(); });
paymentForm.elements.expiry.addEventListener('input', event => { const value=event.target.value.replace(/\D/g,'').slice(0,4); event.target.value=value.length>2?`${value.slice(0,2)}/${value.slice(2)}`:value; });

document.querySelector('#searchForm').addEventListener('submit',event=>{event.preventDefault();state.search=document.querySelector('#globalSearch').value.trim();location.hash='home';renderHome()});
document.querySelector('#menuButton').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('open'));
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.querySelector('#globalSearch').focus()}if(event.key==='Escape'){closeModal();closeAuth();closePayment();closePaymentEdit()}});
window.addEventListener('hashchange',route);
async function boot(){
  try{state.user=(await api('/api/auth/me')).user}catch{state.user=null}
  updateAccountUi(); await route();
}
boot();
