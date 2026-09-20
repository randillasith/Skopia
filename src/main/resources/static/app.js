const app = document.querySelector('#app');
const modalLayer = document.querySelector('#modalLayer');
const modal = modalLayer.querySelector('.modal');
const videoForm = document.querySelector('#videoForm');
const USER_ID = 1;
const state = { categories: [], videos: [], category: '', access: '', search: '', currentVideo: null, progressTimer: null };

const api = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDuration = seconds => {
  seconds = Number(seconds) || 0;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
};
const fmtViews = n => new Intl.NumberFormat('en', { notation: Number(n) > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(n) || 0);
const relativeDate = value => {
  if (!value) return '';
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

function videoCard(v, progress = v.lastPosition || 0) {
  const percent = v.durationSeconds ? Math.min(100, Math.round(progress / v.durationSeconds * 100)) : 0;
  return `<article class="video-card" data-watch="${v.id}" tabindex="0">
    <div class="thumb"><img src="${escapeHtml(v.thumbnailUrl || '')}" alt="" loading="lazy">
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
  const [videos, history] = await Promise.all([api(`/api/videos?${params}`), api('/api/history')]);
  state.videos = videos;
  const hero = videos[0];
  app.innerHTML = `<div class="page">
    <div class="chips" aria-label="Video filters">
      <button class="chip ${!state.category && !state.access ? 'active' : ''}" data-filter="all">All videos</button>
      <button class="chip ${state.access === 'FREE' ? 'active' : ''}" data-access="FREE">Free</button>
      <button class="chip ${state.access === 'PREMIUM' ? 'active' : ''}" data-access="PREMIUM">Premium</button>
      ${state.categories.map(c => `<button class="chip ${String(state.category) === String(c.id) ? 'active' : ''}" data-category="${c.id}">${escapeHtml(c.name)}</button>`).join('')}
    </div>
    ${hero ? `<section class="hero" style="background-image:url('${escapeHtml(hero.thumbnailUrl || '').replace(/'/g,'%27')}')">
      <div class="hero-content"><div class="badges"><span class="badge ${hero.accessType.toLowerCase()}">${hero.accessType}</span><span class="badge">${escapeHtml(hero.category)}</span><span class="badge">${fmtDuration(hero.durationSeconds)}</span></div>
      <h1>${escapeHtml(hero.title)}</h1><p>${escapeHtml(hero.description)}</p>
      <div class="hero-creator"><img src="${escapeHtml(hero.creatorAvatar || 'https://i.pravatar.cc/160?img=12')}" alt=""><strong>${escapeHtml(hero.creatorName || 'Creator')}</strong><span class="material-symbols-outlined" style="color:var(--primary);font-size:17px">verified</span></div>
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
  app.innerHTML = `<div class="page"><div class="watch-layout"><div>
    <video class="player" id="player" controls playsinline poster="${escapeHtml(video.thumbnailUrl || '')}" preload="metadata"><source src="${escapeHtml(video.videoUrl || '')}"></video>
    <section class="watch-info"><div class="badges"><span class="badge ${video.accessType.toLowerCase()}">${video.accessType}</span><span class="badge">${escapeHtml(video.category)}</span></div><h1>${escapeHtml(video.title)}</h1>
      <div class="watch-meta-row"><div class="creator-info"><img src="${escapeHtml(video.creatorAvatar || 'https://i.pravatar.cc/160?img=12')}" alt=""><div><strong>${escapeHtml(video.creatorName || 'Creator')}</strong><small>Content creator</small></div></div>
      <div class="video-actions"><button class="action-button ${video.liked?'active':''}" data-like="${video.id}"><span class="material-symbols-outlined">thumb_up</span><span data-like-count>${fmtViews(video.likeCount)}</span></button><button class="action-button ${video.saved?'active':''}" data-save="${video.id}"><span class="material-symbols-outlined">bookmark</span><span>${video.saved?'Saved':'Save'}</span></button><button class="action-button" data-share="${video.id}"><span class="material-symbols-outlined">share</span>Share</button></div></div>
      <div class="watch-description"><div class="stats">${fmtViews(video.viewCount)} views · ${relativeDate(video.uploadedAt)}</div><div>${escapeHtml(video.description)}</div></div>
    </section></div>
    <aside class="comments-panel"><h2>${comments.length} Comment${comments.length === 1 ? '' : 's'}</h2>
      <form class="comment-form" id="commentForm"><img src="https://i.pravatar.cc/160?img=47" alt=""><textarea name="text" rows="2" maxlength="1000" required placeholder="Add a comment…"></textarea><button aria-label="Post comment"><span class="material-symbols-outlined">send</span></button></form>
      <div id="comments">${commentsHtml(comments)}</div></aside>
  </div></div>`;
  setupPlayer(video);
  document.querySelector('#commentForm').addEventListener('submit', postComment);
  api(`/api/videos/${id}/view`, { method:'POST' }).catch(() => {});
}

function commentsHtml(comments) {
  return comments.length ? comments.map(c => `<div class="comment"><img src="${escapeHtml(c.avatarUrl || 'https://i.pravatar.cc/160?img=33')}" alt=""><div class="comment-body"><div class="comment-head"><strong>${escapeHtml(c.displayName || 'Viewer')}</strong><time>${relativeDate(c.postedAt)}</time></div><p>${escapeHtml(c.text)}</p>${Number(c.userId) === USER_ID ? `<button class="comment-delete" data-delete-comment="${c.id}">Delete</button>`:''}</div></div>`).join('') : '<p style="color:var(--muted);font-size:12px">Be the first to comment.</p>';
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
  event.preventDefault(); const form = event.currentTarget; const text = form.elements.text.value.trim(); if (!text) return;
  try { await api(`/api/videos/${state.currentVideo.id}/comments`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})}); form.reset(); const comments = await api(`/api/videos/${state.currentVideo.id}/comments`); document.querySelector('#comments').innerHTML = commentsHtml(comments); document.querySelector('.comments-panel h2').textContent = `${comments.length} Comment${comments.length === 1?'':'s'}`; toast('Comment posted'); }
  catch (e) { toast(e.message, true); }
}

async function renderCollection(type) {
  loading(); const items = await api(type === 'history' ? '/api/history' : '/api/watchlist');
  const title = type === 'history' ? 'Watch history' : 'Your watchlist';
  const subtitle = type === 'history' ? 'Continue videos you recently watched.' : 'Videos you saved to watch later.';
  app.innerHTML = `<div class="page"><div class="page-title"><div><span class="eyebrow">Your library</span><h1>${title}</h1><p>${subtitle}</p></div></div><div class="video-grid">${items.length ? items.map(v => videoCard({...v,accessType:'FREE',viewCount:v.viewCount || ''},v.lastPosition)).join('') : emptyCard(type === 'history'?'history':'bookmark','Nothing here yet',type === 'history'?'Start watching a video to build your history.':'Save a video and it will appear here.')}</div></div>`;
}

async function renderStudio() {
  loading(); await ensureCategories(); const videos = await api('/api/videos?scope=mine'); state.videos = videos;
  app.innerHTML = `<div class="page"><div class="page-title"><div><span class="eyebrow">Content management</span><h1>Creator Studio</h1><p>Upload, edit, publish, and delete your videos.</p></div><button class="button primary" data-action="open-upload"><span class="material-symbols-outlined">add</span>Upload video</button></div>
    <div class="studio-list">${videos.length ? videos.map(v => `<article class="studio-item"><img src="${escapeHtml(v.thumbnailUrl || '')}" alt=""><div><div class="badges"><span class="badge ${v.accessType.toLowerCase()}">${v.accessType}</span><span class="badge">${v.status}</span></div><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.category)} · ${fmtViews(v.viewCount)} views · ${relativeDate(v.uploadedAt)}</p></div><div class="studio-actions"><button class="icon-btn" title="Preview" data-watch="${v.id}"><span class="material-symbols-outlined">play_arrow</span></button><button class="icon-btn" title="Edit" data-edit="${v.id}"><span class="material-symbols-outlined">edit</span></button><button class="icon-btn" title="Delete" data-delete-video="${v.id}"><span class="material-symbols-outlined">delete</span></button></div></article>`).join('') : emptyCard('video_library','No uploaded videos','Upload your first video to get started.')}</div></div>`;
}

async function route() {
  document.querySelector('#sidebar').classList.remove('open');
  const hash = location.hash.slice(1) || 'home'; const [page,id] = hash.split('/');
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === page || (page === 'watch' && a.dataset.nav === 'home')));
  try {
    if (page === 'watch' && id) await renderWatch(id);
    else if (page === 'history' || page === 'watchlist') await renderCollection(page);
    else if (page === 'studio') await renderStudio();
    else await renderHome();
    app.focus({preventScroll:true}); window.scrollTo(0,0);
  } catch (e) { app.innerHTML = `<div class="empty-state"><div><h2>Could not load this page</h2><p>${escapeHtml(e.message)}</p><button class="button primary" onclick="location.reload()">Try again</button></div></div>`; }
}

async function toggleLike(id, button) {
  try { const result = await api(`/api/videos/${id}/like`,{method:'POST'}); button.classList.toggle('active',result.active); button.querySelector('[data-like-count]').textContent=fmtViews(result.count); }
  catch(e){toast(e.message,true)}
}
async function toggleSave(id, button) {
  try { const result=await api(`/api/videos/${id}/save`,{method:'POST'}); button.classList.toggle('active',result.active); const icon=button.querySelector('.material-symbols-outlined'); if(icon) icon.textContent=result.active?'bookmark_added':'bookmark_add'; const text=[...button.children].find(x=>x.tagName==='SPAN'&&!x.classList.contains('material-symbols-outlined')); if(text) text.textContent=result.active?'Saved':'Save'; toast(result.active?'Saved to watchlist':'Removed from watchlist'); }
  catch(e){toast(e.message,true)}
}

async function openVideoModal(video = null) {
  await ensureCategories(); videoForm.reset(); modal.classList.toggle('edit-mode',!!video); modalLayer.hidden=false; document.body.style.overflow='hidden';
  document.querySelector('#modalTitle').textContent=video?'Edit video':'Upload a video'; document.querySelector('#formSubmit').innerHTML=`<span class="material-symbols-outlined">${video?'save':'cloud_upload'}</span>${video?'Save changes':'Publish video'}`;
  if(video){ videoForm.elements.videoId.value=video.id; videoForm.elements.title.value=video.title; videoForm.elements.description.value=video.description; videoForm.elements.categoryId.value=video.categoryId; videoForm.elements.accessType.value=video.accessType; videoForm.elements.status.value=video.status; videoForm.elements.durationSeconds.value=video.durationSeconds; }
  setTimeout(()=>videoForm.elements.title.focus(),50);
}
function closeModal(){modalLayer.hidden=true;document.body.style.overflow='';}

videoForm.addEventListener('submit',async event=>{
  event.preventDefault(); const submit=document.querySelector('#formSubmit'); submit.disabled=true; const id=videoForm.elements.videoId.value;
  try{
    if(id){ const data={title:videoForm.elements.title.value,description:videoForm.elements.description.value,categoryId:Number(videoForm.elements.categoryId.value),accessType:videoForm.elements.accessType.value,status:videoForm.elements.status.value,videoUrl:videoForm.elements.editVideoUrl.value,thumbnailUrl:videoForm.elements.editThumbnailUrl.value}; await api(`/api/videos/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); toast('Video updated'); }
    else { const data=new FormData(videoForm); if(!data.get('videoFile')?.size&&!data.get('videoUrl')) throw new Error('Choose a video file or enter a video URL'); if(!data.get('thumbnailFile')?.size&&!data.get('thumbnailUrl')) throw new Error('Choose a thumbnail or enter a thumbnail URL'); await api('/api/videos',{method:'POST',body:data}); toast('Video published'); }
    closeModal(); location.hash='studio'; await renderStudio();
  }catch(e){toast(e.message,true)}finally{submit.disabled=false}
});

document.addEventListener('click',async event=>{
  const watch=event.target.closest('[data-watch]'); if(watch){location.hash=`watch/${watch.dataset.watch}`;return}
  const action=event.target.closest('[data-action]'); if(action?.dataset.action==='open-upload'){openVideoModal();return} if(action?.dataset.action==='close-modal'){closeModal();return}
  const category=event.target.closest('[data-category]'); if(category){state.category=category.dataset.category;state.access='';renderHome();return}
  const access=event.target.closest('[data-access]'); if(access){state.access=access.dataset.access;state.category='';renderHome();return}
  if(event.target.closest('[data-filter="all"]')){state.category='';state.access='';renderHome();return}
  const like=event.target.closest('[data-like]'); if(like){toggleLike(like.dataset.like,like);return}
  const save=event.target.closest('[data-save]'); if(save){toggleSave(save.dataset.save,save);return}
  const share=event.target.closest('[data-share]'); if(share){try{await navigator.clipboard.writeText(location.href);toast('Video link copied')}catch{toast('Could not copy link',true)}return}
  const edit=event.target.closest('[data-edit]'); if(edit){const video=await api(`/api/videos/${edit.dataset.edit}`);openVideoModal(video);return}
  const del=event.target.closest('[data-delete-video]'); if(del&&confirm('Delete this video permanently?')){try{await api(`/api/videos/${del.dataset.deleteVideo}`,{method:'DELETE'});toast('Video deleted');renderStudio()}catch(e){toast(e.message,true)}return}
  const comment=event.target.closest('[data-delete-comment]'); if(comment&&confirm('Delete your comment?')){try{await api(`/api/comments/${comment.dataset.deleteComment}`,{method:'DELETE'});comment.closest('.comment').remove();toast('Comment deleted')}catch(e){toast(e.message,true)}}
});

document.querySelector('#searchForm').addEventListener('submit',event=>{event.preventDefault();state.search=document.querySelector('#globalSearch').value.trim();location.hash='home';renderHome()});
document.querySelector('#menuButton').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('open'));
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.querySelector('#globalSearch').focus()}if(event.key==='Escape')closeModal()});
window.addEventListener('hashchange',route);
route();
