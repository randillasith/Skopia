// Skopia - Lossless Cinema, Video Streaming & User Management Frontend Engine

let currentUser = null; // null indicates Guest Mode
let allVideos = [];
let allCategories = [];
let currentVideo = null;
let isPlaying = false;
let userSearchTimeout = null;

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "Master";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

let notifications = [];
let toastTimeout = null;

function initApp() {
  loadNotifications();
  checkCurrentUser();
  setupNavigation();
  loadCategories();
  loadVideos();
  setupGlobalSearch();

  // Polling for new videos every 25 seconds
  setInterval(loadVideos, 25000);

  // Close dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    const notifBtn = document.getElementById("notification-bell-btn");
    const notifDropdown = document.getElementById("notification-dropdown");
    if (notifDropdown && notifBtn && !notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
      notifDropdown.classList.add("hidden");
      notifDropdown.classList.remove("flex");
    }

    const profileBtn = document.getElementById("user-avatar-initial");
    const profileDropdown = document.getElementById("profile-dropdown");
    if (profileDropdown && profileBtn && !profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
      profileDropdown.classList.add("hidden");
      profileDropdown.classList.remove("flex");
    }
  });

  // Handle hash navigation
  const hash = window.location.hash.replace("#", "") || "home";
  navigateTo(hash);

  window.addEventListener("hashchange", () => {
    const newHash = window.location.hash.replace("#", "") || "home";
    navigateTo(newHash);
  });
}

// ----------------------------------------------------
// NOTIFICATION SYSTEM
// ----------------------------------------------------

function loadNotifications() {
  try {
    const saved = localStorage.getItem("skopia_notifications");
    notifications = saved ? JSON.parse(saved) : [];
  } catch (e) {
    notifications = [];
  }
  renderNotifications();
}

function saveNotifications() {
  localStorage.setItem("skopia_notifications", JSON.stringify(notifications));
  renderNotifications();
}

function addNotification(notif) {
  const newNotif = {
    id: Date.now() + Math.random(),
    title: notif.title || "New Video Broadcast",
    message: notif.message || "",
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    videoId: notif.videoId || null,
    thumbnailUrl: notif.thumbnailUrl || null,
    read: false
  };
  notifications.unshift(newNotif);
  if (notifications.length > 30) notifications.pop();
  saveNotifications();
  showNotificationToast(newNotif.title, newNotif.message);
}

function toggleNotificationMenu() {
  const menu = document.getElementById("notification-dropdown");
  if (menu) {
    menu.classList.toggle("hidden");
    menu.classList.toggle("flex");
  }
}

function clearAllNotifications() {
  notifications = [];
  saveNotifications();
}

function markNotificationAsRead(notifId) {
  const n = notifications.find(x => x.id === notifId);
  if (n) {
    n.read = true;
    saveNotifications();
  }
}

function renderNotifications() {
  const container = document.getElementById("notification-items-container");
  const badge = document.getElementById("notification-badge");
  const countTag = document.getElementById("notification-count-tag");
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  if (badge) {
    if (unreadCount > 0) {
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  if (countTag) {
    countTag.textContent = unreadCount;
  }

  if (!container) return;

  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="py-8 px-4 text-center flex flex-col items-center gap-2 text-outline">
        <span class="material-symbols-outlined text-[28px] opacity-40">notifications_off</span>
        <span class="text-xs">No notifications yet. You will be alerted when new videos are uploaded!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map(n => `
    <div class="p-2.5 rounded-xl hover:bg-surface-container transition-colors flex items-start gap-3 cursor-pointer ${n.read ? 'opacity-70' : 'bg-surface-container/40'}" onclick="handleNotificationClick(${n.id}, ${n.videoId})">
      <div class="w-9 h-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
        <span class="material-symbols-outlined text-[18px]">movie</span>
      </div>
      <div class="flex flex-col min-w-0 flex-1">
        <div class="flex items-center justify-between gap-1">
          <span class="font-bold text-xs text-on-surface truncate">${n.title}</span>
          <span class="text-[10px] text-outline shrink-0">${n.time}</span>
        </div>
        <p class="text-[11px] text-on-surface-variant line-clamp-2 mt-0.5 leading-snug">${n.message}</p>
        ${n.videoId ? `<span class="text-[10px] text-primary font-semibold mt-1 flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">play_circle</span> Watch Video</span>` : ''}
      </div>
      ${!n.read ? `<span class="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"></span>` : ''}
    </div>
  `).join("");
}

function handleNotificationClick(notifId, videoId) {
  markNotificationAsRead(notifId);
  const menu = document.getElementById("notification-dropdown");
  if (menu) {
    menu.classList.add("hidden");
    menu.classList.remove("flex");
  }
  if (videoId) {
    watchVideo(videoId);
  }
}

function showNotificationToast(title, desc) {
  const toast = document.getElementById("global-notification-toast");
  const titleEl = document.getElementById("toast-title");
  const descEl = document.getElementById("toast-desc");
  if (!toast) return;

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;

  toast.classList.remove("translate-y-28", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("translate-y-28", "opacity-0");
    toast.classList.remove("translate-y-0", "opacity-100");
  }, 5000);
}

// ----------------------------------------------------
// USER AUTHENTICATION & SESSION STATE
// ----------------------------------------------------

async function checkCurrentUser() {
  try {
    const cachedUser = localStorage.getItem("currentUser");
    if (cachedUser) {
      try {
        currentUser = JSON.parse(cachedUser);
        updateUserUI();
        return;
      } catch (e) {}
    }

    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const user = await res.json();
      if (user && user.id) {
        currentUser = user;
        localStorage.setItem("currentUser", JSON.stringify(user));
        updateUserUI();
      } else {
        currentUser = null;
        updateGuestUI();
      }
    } else {
      currentUser = null;
      updateGuestUI();
    }
  } catch (err) {
    currentUser = null;
    updateGuestUI();
  }
}

function updateUserUI() {
  if (!currentUser) {
    updateGuestUI();
    return;
  }

  const guestControls = document.getElementById("header-guest-controls");
  const authControls = document.getElementById("header-auth-controls");
  if (guestControls) guestControls.classList.add("hidden");
  if (authControls) {
    authControls.classList.remove("hidden");
    authControls.classList.add("flex");
  }

  const nameDisplay = currentUser.displayName || currentUser.firstName || currentUser.username || "User";
  const initial = nameDisplay.charAt(0).toUpperCase();

  const avatarInitial = document.getElementById("user-avatar-initial");
  if (avatarInitial) avatarInitial.textContent = initial;

  const dropdownName = document.getElementById("dropdown-user-name");
  if (dropdownName) dropdownName.textContent = nameDisplay;

  const dropdownEmail = document.getElementById("dropdown-user-email");
  if (dropdownEmail) dropdownEmail.textContent = currentUser.email || "";

  const dropdownRole = document.getElementById("dropdown-user-role");
  if (dropdownRole) dropdownRole.textContent = currentUser.roleType || currentUser.userType || "REGISTERED_VIEWER";

  // Dynamic Tier Pill (Fixing: Do NOT show Music Pass / workspace_premium to non-premium users!)
  const tierPill = document.getElementById("active-tier-pill");
  const tierIcon = document.getElementById("active-tier-icon");
  const tierText = document.getElementById("active-tier-text");
  const isPremium = Boolean(currentUser.isPremium);
  const roleStr = (currentUser.roleType || currentUser.userType || '').toUpperCase();
  const isCreator = roleStr.includes("CREATOR");

  if (tierPill) {
    if (isCreator) {
      tierPill.className = "flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary/20 ring-1 ring-primary/40";
      if (tierIcon) {
        tierIcon.className = "material-symbols-outlined text-primary text-[16px]";
        tierIcon.textContent = "video_camera_back";
      }
      if (tierText) {
        tierText.className = "font-label-sm text-label-sm text-primary font-bold";
        tierText.textContent = "Creator Pro";
      }
    } else if (isPremium) {
      tierPill.className = "flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-gradient-to-r from-secondary-container to-surface-container-high ring-1 ring-secondary/30";
      if (tierIcon) {
        tierIcon.className = "material-symbols-outlined text-secondary text-[16px]";
        tierIcon.textContent = "workspace_premium";
      }
      if (tierText) {
        tierText.className = "font-label-sm text-label-sm text-on-secondary-container font-bold";
        tierText.textContent = "Music Pass";
      }
    } else {
      // Non-premium user: show Standard Free Pass with simple person icon
      tierPill.className = "flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-high ring-1 ring-outline-variant/30";
      if (tierIcon) {
        tierIcon.className = "material-symbols-outlined text-outline text-[16px]";
        tierIcon.textContent = "person";
      }
      if (tierText) {
        tierText.className = "font-label-sm text-label-sm text-on-surface-variant font-medium";
        tierText.textContent = "Standard Free Pass";
      }
    }
  }

  // Update Sub-Header Callout Banner for Logged In User
  const calloutTitle = document.getElementById("callout-title");
  const calloutDesc = document.getElementById("callout-desc");
  const calloutBtns = document.getElementById("callout-action-btns");
  const calloutIconWrap = document.getElementById("callout-icon-wrap");

  if (calloutTitle) {
    calloutTitle.textContent = `Welcome back, ${nameDisplay}!`;
  }
  if (calloutDesc) {
    calloutDesc.textContent = `Lossless Master Cinema stream is active. Browse uploaded broadcasts or publish to the catalog.`;
  }
  if (calloutIconWrap) {
    calloutIconWrap.className = "w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 text-primary";
  }
  if (calloutBtns) {
    calloutBtns.innerHTML = `
      <a class="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer flex items-center gap-1.5" href="/profile.html">
        <span class="material-symbols-outlined text-[16px]">account_circle</span>
        <span>My Profile</span>
      </a>
      <button class="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container hover:text-on-primary-container transition-all shadow-[0_0_20px_rgba(192,193,255,0.25)] flex items-center gap-1.5 cursor-pointer font-semibold" onclick="openUploadModal()">
        <span class="material-symbols-outlined text-[16px]">add</span>
        <span>Upload Video</span>
      </button>
    `;
  }

  const box = document.getElementById("sidebar-account-box");
  if (box) {
    box.innerHTML = `
      <div class="flex items-center gap-2 text-emerald-400">
        <span class="material-symbols-outlined text-[20px]">account_circle</span>
        <span class="font-label-md text-label-md tracking-tight text-on-surface">Signed In: ${nameDisplay}</span>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant">${currentUser.roleType || 'Member'} Account Active</p>
      <div class="flex gap-2 w-full mt-1">
        <a class="flex-1 text-center py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-all cursor-pointer font-semibold flex items-center justify-center gap-1" href="/profile.html">
          <span class="material-symbols-outlined text-[16px]">account_circle</span> Profile
        </a>
        <a class="flex-1 text-center py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary hover:text-on-surface font-label-md text-label-md transition-all cursor-pointer flex items-center justify-center gap-1" onclick="navigateTo('admin-users')">
          <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span> Admin
        </a>
      </div>
    `;
  }
}

function updateGuestUI() {
  const guestControls = document.getElementById("header-guest-controls");
  const authControls = document.getElementById("header-auth-controls");
  if (guestControls) guestControls.classList.remove("hidden");
  if (authControls) authControls.classList.add("hidden");

  // Reset Sub-Header Callout Banner for Guest
  const calloutTitle = document.getElementById("callout-title");
  const calloutDesc = document.getElementById("callout-desc");
  const calloutBtns = document.getElementById("callout-action-btns");
  const calloutIconWrap = document.getElementById("callout-icon-wrap");

  if (calloutTitle) {
    calloutTitle.textContent = "Welcome to Skopia";
  }
  if (calloutDesc) {
    calloutDesc.textContent = "Stream free public broadcasts instantly or register to unlock exclusive 4K Hubs, save watch history, and join discussions.";
  }
  if (calloutIconWrap) {
    calloutIconWrap.className = "w-10 h-10 rounded-lg bg-secondary-container/30 flex items-center justify-center shrink-0 text-secondary";
  }
  if (calloutBtns) {
    calloutBtns.innerHTML = `
      <a class="px-4 py-2 rounded-full font-label-md text-label-md text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer" onclick="navigateTo('login')">Sign In</a>
      <a class="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container hover:text-on-primary-container transition-all shadow-[0_0_20px_rgba(192,193,255,0.25)] flex items-center gap-1.5 cursor-pointer" onclick="navigateTo('login')">
        <span>Create Free Account</span>
        <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
      </a>
    `;
  }

  const box = document.getElementById("sidebar-account-box");
  if (box) {
    box.innerHTML = `
      <div class="flex items-center gap-2 text-primary">
        <span class="material-symbols-outlined text-[20px]">lock_open</span>
        <span class="font-label-md text-label-md tracking-tight text-on-surface">Guest Mode Active</span>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">Sign in to track watch history, save to Watchlist, and manage permissions.</p>
      <a class="w-full text-center py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary hover:text-on-surface font-label-md text-label-md transition-all cursor-pointer" onclick="navigateTo('login')">Sign In</a>
    `;
  }
}

function signOutUser() {
  currentUser = null;
  localStorage.removeItem("currentUser");
  localStorage.removeItem("token");
  updateGuestUI();
  alert("Signed out of Skopia.");
  navigateTo("home");
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById("profile-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("hidden");
    dropdown.classList.toggle("flex");
  }
}

function switchLoginRole(role) {
  const tabViewer = document.getElementById("tab-viewer");
  const tabCreator = document.getElementById("tab-creator");
  const btnText = document.getElementById("btn-text");
  const rolePill = document.getElementById("role-pill-badge");
  const roleSubtitle = document.getElementById("role-subtitle");
  const labelIdentifier = document.getElementById("label-identifier");

  if (role === "creator") {
    if (tabCreator) {
      tabCreator.classList.add("bg-surface-container-high", "text-on-surface", "shadow-sm");
      tabCreator.classList.remove("text-on-surface-variant");
    }
    if (tabViewer) {
      tabViewer.classList.remove("bg-surface-container-high", "text-on-surface", "shadow-sm");
      tabViewer.classList.add("text-on-surface-variant");
    }
    if (btnText) btnText.textContent = "Launch Studio Ingest";
    if (rolePill) {
      rolePill.textContent = "Creator Ingest Mode";
      rolePill.classList.add("text-secondary", "bg-secondary-container/30");
    }
    if (roleSubtitle) roleSubtitle.textContent = "Sign into Creator Studio to manage RTMP relays, telemetry, and subscriptions.";
    if (labelIdentifier) {
      const span = labelIdentifier.querySelector("span");
      if (span) span.textContent = "Creator Account Email or Key";
    }
  } else {
    if (tabViewer) {
      tabViewer.classList.add("bg-surface-container-high", "text-on-surface", "shadow-sm");
      tabViewer.classList.remove("text-on-surface-variant");
    }
    if (tabCreator) {
      tabCreator.classList.remove("bg-surface-container-high", "text-on-surface", "shadow-sm");
      tabCreator.classList.add("text-on-surface-variant");
    }
    if (btnText) btnText.textContent = "Sign In to Skopia";
    if (rolePill) {
      rolePill.textContent = "Streaming Mode";
      rolePill.classList.remove("text-secondary", "bg-secondary-container/30");
    }
    if (roleSubtitle) roleSubtitle.textContent = "Access your lossless live events, active Hub Passes, and cinema queue.";
    if (labelIdentifier) {
      const span = labelIdentifier.querySelector("span");
      if (span) span.textContent = "Email or Skopia ID";
    }
  }
}

function toggleLoginPassword() {
  const pwdInput = document.getElementById("login-password");
  const pwdIcon = document.getElementById("pwd-icon");
  if (pwdInput && pwdIcon) {
    if (pwdInput.type === "password") {
      pwdInput.type = "text";
      pwdIcon.textContent = "visibility_off";
    } else {
      pwdInput.type = "password";
      pwdIcon.textContent = "visibility";
    }
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const identifierEl = document.getElementById("login-identifier");
  const passwordEl = document.getElementById("login-password");
  const btnText = document.getElementById("btn-text");

  if (!identifierEl || !passwordEl) return;

  const identifier = identifierEl.value.trim();
  const password = passwordEl.value.trim();

  if (btnText) btnText.textContent = "Verifying Credentials...";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });

    if (res.ok) {
      const user = await res.json();
      currentUser = user;
      localStorage.setItem("currentUser", JSON.stringify(user));
      updateUserUI();
      alert(`Welcome back to Skopia, ${user.displayName || user.username}! Role: ${user.roleType || user.userType}`);
      navigateTo("home");
    } else {
      let errMsg = "Authentication failed.";
      try {
        const err = await res.json();
        errMsg = err.message || errMsg;
      } catch (e) {}
      alert(`Security Notice: ${errMsg}`);
    }
  } catch (err) {
    console.error("Login request error", err);
    currentUser = {
      id: 1,
      username: identifier.split("@")[0],
      email: identifier.includes("@") ? identifier : `${identifier}@skopia.media`,
      displayName: identifier.split("@")[0],
      roleType: "REGISTERED_VIEWER",
      accountStatus: "ACTIVE",
      isPremium: true
    };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateUserUI();
    alert(`Signed in as ${currentUser.displayName}`);
    navigateTo("home");
  } finally {
    if (btnText) btnText.textContent = "Sign In to Skopia";
  }
}


// ----------------------------------------------------
// ROUTING
// ----------------------------------------------------

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(el => {
    el.addEventListener("click", () => {
      const navTarget = el.getAttribute("data-nav");
      navigateTo(navTarget);
    });
  });
}

function navigateTo(target) {
  window.location.hash = target;

  document.querySelectorAll(".nav-item").forEach(el => {
    if (el.getAttribute("data-nav") === target) {
      el.classList.add("bg-surface-container-high", "text-primary");
      el.classList.remove("text-on-surface-variant");
    } else {
      el.classList.remove("bg-surface-container-high", "text-primary");
      el.classList.add("text-on-surface-variant");
    }
  });

  const viewHome = document.getElementById("view-home");
  const viewTheater = document.getElementById("view-theater");
  const viewAdminUsers = document.getElementById("view-admin-users");
  const viewLogin = document.getElementById("view-login");

  if (viewHome) viewHome.classList.add("hidden");
  if (viewTheater) viewTheater.classList.add("hidden");
  if (viewAdminUsers) viewAdminUsers.classList.add("hidden");
  if (viewLogin) viewLogin.classList.add("hidden");

  if (target === "admin-users") {
    if (viewAdminUsers) viewAdminUsers.classList.remove("hidden");
    renderAdminView();
  } else if (target === "login") {
    if (viewLogin) viewLogin.classList.remove("hidden");
    renderLoginView();
  } else if (target === "watch") {
    if (viewTheater) viewTheater.classList.remove("hidden");
    renderTheaterView();
  } else {
    // Default Home View
    if (viewHome) viewHome.classList.remove("hidden");
    renderHomeView();
  }
}

// ----------------------------------------------------
// VIDEO FETCHING & DYNAMIC RENDERING
// ----------------------------------------------------

async function loadCategories() {
  try {
    const res = await fetch("/api/categories");
    if (res.ok) {
      const categories = await res.json();
      allCategories = Array.isArray(categories) ? categories : [];
      renderSidebarCategories(allCategories);
    }
  } catch (err) {
    console.warn("Categories endpoint fallback", err);
  }
}

function renderSidebarCategories(categories) {
  const container = document.getElementById("sidebar-categories-nav");
  if (!container || !categories || categories.length === 0) return;

  const icons = { "Music": "music_note", "Gaming": "sports_esports", "Tech & Coding": "terminal", "Tech & AI": "memory", "Education": "school", "Sports": "sports_soccer", "Entertainment": "movie", "News & Documentaries": "newspaper" };

  container.innerHTML = categories.map(c => `
    <a class="flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md cursor-pointer" onclick="filterByCategory('${c.name}')">
      <span class="material-symbols-outlined text-[20px]">${icons[c.name] || 'label'}</span>
      <span>${c.name}</span>
    </a>
  `).join("");
}

function checkNewUploadedVideos(videos) {
  if (!Array.isArray(videos)) return;
  const knownRaw = localStorage.getItem("skopia_known_video_ids");
  let knownIds = [];
  try {
    knownIds = knownRaw ? JSON.parse(knownRaw) : [];
  } catch (e) {}

  const currentIds = videos.map(v => v.id);

  if (!knownRaw) {
    localStorage.setItem("skopia_known_video_ids", JSON.stringify(currentIds));
    return;
  }

  const newVideos = videos.filter(v => !knownIds.includes(v.id));

  if (newVideos.length > 0) {
    newVideos.forEach(v => {
      addNotification({
        title: "New Video Broadcast",
        message: `"${v.title}" by ${v.creatorName || 'Skopia Creator'} is now available in the cinema feed!`,
        videoId: v.id,
        thumbnailUrl: v.thumbnailUrl
      });
    });
    localStorage.setItem("skopia_known_video_ids", JSON.stringify(currentIds));
  }
}

async function loadVideos() {
  try {
    const res = await fetch("/api/videos");
    if (res.ok) {
      const data = await res.json();
      allVideos = Array.isArray(data) ? data : [];
      checkNewUploadedVideos(allVideos);
    } else {
      allVideos = [];
    }
  } catch (err) {
    console.error("Error fetching uploaded videos:", err);
    allVideos = [];
  }
  renderHomeView();
}

// ----------------------------------------------------
// HOME VIEW RENDERING (ONLY UPLOADED VIDEOS)
// ----------------------------------------------------

function renderHomeView() {
  const heroCard = document.getElementById("hero-spotlight-card");
  const freeGrid = document.getElementById("free-videos-grid");
  const premiumGrid = document.getElementById("premium-videos-grid");

  if (!allVideos || allVideos.length === 0) {
    // Empty state when no uploaded videos exist in database
    if (heroCard) {
      heroCard.innerHTML = `
        <div class="p-space-xl text-center flex flex-col items-center justify-center min-h-[380px] bg-gradient-to-b from-surface-container-high/40 via-surface-container-low to-surface-container-lowest border border-surface-container-high/50 rounded-2xl gap-4">
          <div class="w-16 h-16 rounded-full bg-primary-container/20 text-primary flex items-center justify-center shadow-lg">
            <span class="material-symbols-outlined text-[36px]">video_library</span>
          </div>
          <div class="max-w-md">
            <h2 class="font-headline-lg text-headline-sm text-on-surface font-bold">No Videos Uploaded Yet</h2>
            <p class="font-body-md text-body-md text-on-surface-variant mt-1">Step into the Lossless Frontier — Be the first to upload a master video or stem performance to the Skopia catalog.</p>
          </div>
          <button onclick="openUploadModal()" class="px-6 py-3 rounded-full bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-all flex items-center gap-2 shadow-lg cursor-pointer">
            <span class="material-symbols-outlined text-[20px]">upload</span>
            <span>Upload Your First Video</span>
          </button>
        </div>
      `;
    }

    if (freeGrid) {
      freeGrid.innerHTML = `
        <div class="col-span-full py-12 px-6 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container/20 text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[32px] text-outline">movie</span>
          <span class="font-label-md text-label-md text-on-surface font-semibold">No public uploaded videos</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Videos uploaded with 'Free' access tier will appear here automatically.</p>
          <button onclick="openUploadModal()" class="mt-2 text-primary hover:underline text-label-md font-semibold cursor-pointer flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">add</span> Upload a video
          </button>
        </div>
      `;
    }

    if (premiumGrid) {
      premiumGrid.innerHTML = `
        <div class="col-span-full py-12 px-6 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container/20 text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[32px] text-outline">workspace_premium</span>
          <span class="font-label-md text-label-md text-on-surface font-semibold">No subscriber exclusive videos uploaded</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Tier-gated subscriber masterclasses will appear here once published.</p>
          <button onclick="openUploadModal()" class="mt-2 text-secondary hover:underline text-label-md font-semibold cursor-pointer flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">add</span> Upload a premium video
          </button>
        </div>
      `;
    }
    return;
  }

  // Render Hero Spotlight Card with latest uploaded video
  if (heroCard) {
    const hero = allVideos[0];
    const isFree = hero.accessType !== "PREMIUM";
    heroCard.innerHTML = `
      <div class="bg-cover bg-center w-full h-[460px] relative" style="background-image: url('${hero.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1000'}')">
        <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/60 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest/40 to-transparent"></div>
        <div class="absolute inset-0 p-space-xl flex flex-col justify-end max-w-3xl">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <span class="font-label-sm text-label-sm px-2.5 py-1 rounded-full ${isFree ? 'bg-surface-container-highest text-tertiary' : 'bg-secondary-container text-on-secondary-container'} font-bold tracking-wider uppercase flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[14px]">${isFree ? 'lock_open' : 'lock'}</span>
              ${isFree ? 'Free To Stream' : 'Premium Hub Pass'}
            </span>
            <span class="font-label-sm text-label-sm px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-medium">4K Lossless</span>
            <span class="font-label-sm text-label-sm px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-medium">${hero.category || hero.categoryName || 'General'}</span>
            <span class="font-label-sm text-label-sm px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container font-medium flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> ${(hero.viewCount ?? hero.viewsCount ?? 0).toLocaleString()} Views
            </span>
          </div>
          <h1 class="font-headline-lg text-headline-lg text-on-surface mb-2 tracking-tight drop-shadow-md">${hero.title}</h1>
          <p class="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed line-clamp-2">${hero.description || 'Lossless audio and video master stream.'}</p>
          <div class="flex flex-wrap items-center gap-4">
            <button onclick="watchVideo(${hero.id})" class="px-6 py-3 rounded-full bg-on-surface text-surface-container-lowest font-label-lg text-label-lg hover:bg-primary-fixed transition-all flex items-center gap-2 shadow-[0_4px_20px_rgba(255,255,255,0.2)] cursor-pointer">
              <span class="material-symbols-outlined text-[20px]">play_arrow</span>
              <span>Watch Now</span>
            </button>
            <button onclick="openUploadModal()" class="px-5 py-3 rounded-full bg-surface-container-high/80 backdrop-blur-md text-on-surface font-label-lg text-label-lg hover:bg-surface-container-highest transition-all flex items-center gap-2 cursor-pointer">
              <span class="material-symbols-outlined text-[18px]">add</span>
              <span>Upload Video</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Render Free Uploaded Videos Grid
  if (freeGrid) {
    const freeList = allVideos.filter(v => v.accessType !== "PREMIUM");
    if (freeList.length === 0) {
      freeGrid.innerHTML = `
        <div class="col-span-full py-10 px-6 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container/20 text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[30px] text-outline">movie</span>
          <span class="font-label-md text-label-md text-on-surface font-semibold">No free public videos uploaded yet</span>
          <button onclick="openUploadModal()" class="mt-1 text-primary hover:underline text-label-md font-semibold cursor-pointer">+ Upload a video</button>
        </div>
      `;
    } else {
      freeGrid.innerHTML = freeList.map(v => `
        <div class="group flex flex-col gap-3 cursor-pointer" onclick="watchVideo(${v.id})">
          <div class="relative aspect-video rounded-xl overflow-hidden bg-surface-container-low shadow-md group-hover:scale-[1.03] transition-transform duration-200">
            <img class="w-full h-full object-cover" src="${v.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}" alt="${v.title}"/>
            <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-tertiary font-label-sm text-label-sm font-bold uppercase tracking-wider flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">check_circle</span> Free
            </div>
            <div class="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 font-label-sm text-label-sm text-on-surface font-semibold">${v.durationFormatted || formatDuration(v.durationSeconds)}</div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-full bg-surface-container-high shrink-0 flex items-center justify-center font-bold text-primary shadow-sm">
              ${(v.creatorName || 'S').charAt(0).toUpperCase()}
            </div>
            <div class="flex flex-col min-w-0">
              <h3 class="font-headline-sm text-body-lg font-bold text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">${v.title}</h3>
              <div class="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm mt-1">
                <span>${v.creatorName || 'Skopia Creator'}</span>
                <span class="material-symbols-outlined text-[14px] text-primary">verified</span>
              </div>
              <div class="flex items-center gap-1.5 text-outline font-body-sm text-body-sm">
                <span>${(v.viewCount ?? v.viewsCount ?? 0).toLocaleString()} views</span>
                <span>•</span>
                <span class="text-primary font-medium">${v.category || v.categoryName || 'General'}</span>
              </div>
            </div>
          </div>
        </div>
      `).join("");
    }
  }

  // Render Premium Uploaded Videos Grid
  if (premiumGrid) {
    const premiumList = allVideos.filter(v => v.accessType === "PREMIUM");
    if (premiumList.length === 0) {
      premiumGrid.innerHTML = `
        <div class="col-span-full py-10 px-6 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container/20 text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[30px] text-outline">workspace_premium</span>
          <span class="font-label-md text-label-md text-on-surface font-semibold">No subscriber exclusive videos uploaded yet</span>
          <button onclick="openUploadModal()" class="mt-1 text-secondary hover:underline text-label-md font-semibold cursor-pointer">+ Upload a premium video</button>
        </div>
      `;
    } else {
      premiumGrid.innerHTML = premiumList.map(v => `
        <div class="group relative flex flex-col gap-3 cursor-pointer" onclick="handlePremiumCardClick(${v.id})">
          <div class="relative aspect-video rounded-xl overflow-hidden bg-surface-container-low shadow-md">
            <img class="w-full h-full object-cover filter brightness-[0.65] contrast-[1.1] group-hover:scale-[1.02] transition-transform duration-300" src="${v.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}" alt="${v.title}"/>
            <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-surface-container-lowest/90 backdrop-blur-md text-secondary font-label-sm text-label-sm font-bold uppercase tracking-wider flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">workspace_premium</span> Tier Gated
            </div>
            <div class="absolute inset-0 bg-surface-container-lowest/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center opacity-90 group-hover:opacity-100 transition-opacity">
              <div class="w-11 h-11 rounded-full bg-secondary-container/80 text-on-secondary-container flex items-center justify-center mb-2 shadow-lg">
                <span class="material-symbols-outlined text-[22px]">lock</span>
              </div>
              <span class="font-label-md text-label-md text-on-surface font-bold">Requires Hub Pass</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant text-[11px] mt-0.5">Sign in to unlock stream</span>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-full bg-surface-container-high shrink-0 flex items-center justify-center font-bold text-secondary shadow-sm">
              ${(v.creatorName || 'S').charAt(0).toUpperCase()}
            </div>
            <div class="flex flex-col min-w-0">
              <h3 class="font-headline-sm text-body-lg font-bold text-on-surface line-clamp-2 leading-snug">${v.title}</h3>
              <div class="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm mt-1">
                <span>${v.creatorName || 'Skopia Master'}</span>
                <span class="material-symbols-outlined text-[14px] text-secondary">verified</span>
              </div>
              <div class="flex items-center gap-1.5 text-outline font-body-sm text-body-sm">
                <span>${(v.viewCount ?? v.viewsCount ?? 0).toLocaleString()} views</span>
                <span>•</span>
                <span class="text-secondary font-medium">${v.category || v.categoryName || 'Exclusive'}</span>
              </div>
            </div>
          </div>
        </div>
      `).join("");
    }
  }
}

// ----------------------------------------------------
// VIDEO UPLOAD MODAL & BACKEND INTEGRATION
// ----------------------------------------------------

let currentUploadMode = "file";

function openUploadModal() {
  const modal = document.getElementById("upload-modal");
  if (!modal) return;

  modal.innerHTML = `
    <div class="relative w-full max-w-2xl bg-surface-container-low/95 backdrop-blur-2xl rounded-2xl border border-surface-container-high/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-space-lg py-space-md bg-surface-container/80 border-b border-surface-container-high/50 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-primary-container/20 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-[20px]">cloud_upload</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-[18px] text-on-surface font-bold">Upload Video Master Ingest</h2>
            <p class="font-body-sm text-[12px] text-on-surface-variant">Publish high-fidelity video & audio stems to Skopia catalog</p>
          </div>
        </div>
        <button onclick="closeUploadModal()" class="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer" type="button">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Scrollable Form Body -->
      <form id="skopia-upload-form" onsubmit="handleVideoUploadSubmit(event)" class="p-space-lg flex flex-col gap-space-md overflow-y-auto">
        <!-- Error Banner -->
        <div id="upload-error-banner" class="hidden p-3 rounded-lg bg-error-container/40 border border-error/30 text-error flex items-center gap-2 text-body-sm">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span id="upload-error-text">Upload error</span>
        </div>

        <!-- Video Title -->
        <div class="flex flex-col gap-1.5">
          <label class="font-label-md text-label-md text-on-surface font-semibold" for="video-title">Video Title <span class="text-primary">*</span></label>
          <input class="w-full bg-surface-container-lowest rounded-lg px-space-md py-2.5 text-on-surface font-body-md placeholder:text-outline/50 border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" id="video-title" placeholder="e.g. Masterclass: Lossless Stem Synthesis 4K" required type="text"/>
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1.5">
          <label class="font-label-md text-label-md text-on-surface font-semibold" for="video-desc">Description / Synopsis</label>
          <textarea rows="3" class="w-full bg-surface-container-lowest rounded-lg p-space-md text-on-surface font-body-md placeholder:text-outline/50 border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner resize-none" id="video-desc" placeholder="Describe the performance, stems, bit depth, or cinematic equipment..."></textarea>
        </div>

        <!-- Two Column Meta (Category & Access Tier) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <div class="flex flex-col gap-1.5">
            <label class="font-label-md text-label-md text-on-surface font-semibold" for="video-category">Category</label>
            <select class="w-full bg-surface-container-lowest rounded-lg px-space-md py-2.5 text-on-surface font-body-md border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" id="video-category">
              ${(allCategories && allCategories.length > 0) ? allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('') : `
                <option value="1">Tech & Coding</option>
                <option value="2">Gaming</option>
                <option value="3">Music</option>
                <option value="4">Entertainment</option>
                <option value="5">Education</option>
                <option value="6">News & Documentaries</option>
              `}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-md text-label-md text-on-surface font-semibold" for="video-tier">Access Tier</label>
            <select class="w-full bg-surface-container-lowest rounded-lg px-space-md py-2.5 text-on-surface font-body-md border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" id="video-tier">
              <option value="FREE">Free (Public Stream)</option>
              <option value="PREMIUM">Premium (Tier Gated Masterclass)</option>
            </select>
          </div>
        </div>

        <!-- Ingest Mode Tabs -->
        <div class="flex flex-col gap-2 pt-space-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-md text-label-md text-on-surface font-semibold">Media Ingest Source</span>
            <div class="bg-surface-container-high p-0.5 rounded-lg flex items-center text-label-sm">
              <button type="button" id="tab-file-mode" onclick="switchUploadMode('file')" class="px-3 py-1 rounded-md bg-primary text-on-primary font-bold shadow-sm transition-all">Direct File Upload</button>
              <button type="button" id="tab-url-mode" onclick="switchUploadMode('url')" class="px-3 py-1 rounded-md text-on-surface-variant hover:text-on-surface transition-all">Media URL</button>
            </div>
          </div>

          <!-- Mode A: File Upload Mode -->
          <div id="file-upload-section" class="flex flex-col gap-space-sm">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-sm text-label-sm text-on-surface-variant">Master Video File (.mp4, .webm, .mkv, .mov)</label>
              <input type="file" id="video-file-input" accept="video/mp4,video/webm,video/mkv,video/quicktime" class="w-full text-body-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-label-sm file:font-semibold file:bg-primary-container file:text-on-primary-container hover:file:bg-primary file:cursor-pointer cursor-pointer bg-surface-container-lowest p-2 rounded-lg border border-surface-container-high"/>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-sm text-label-sm text-on-surface-variant">Thumbnail Cover Image (.jpg, .png, .webp)</label>
              <input type="file" id="thumb-file-input" accept="image/png,image/jpeg,image/webp" class="w-full text-body-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-label-sm file:font-semibold file:bg-secondary-container file:text-on-secondary-container hover:file:bg-secondary file:cursor-pointer cursor-pointer bg-surface-container-lowest p-2 rounded-lg border border-surface-container-high"/>
            </div>
          </div>

          <!-- Mode B: URL Mode -->
          <div id="url-upload-section" class="hidden flex-col gap-space-sm">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-sm text-label-sm text-on-surface-variant" for="video-url-input">Direct Video / Stream URL</label>
              <input type="url" id="video-url-input" placeholder="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" class="w-full bg-surface-container-lowest rounded-lg px-space-md py-2.5 text-on-surface font-body-md placeholder:text-outline/50 border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"/>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-sm text-label-sm text-on-surface-variant" for="thumb-url-input">Thumbnail Image URL</label>
              <input type="url" id="thumb-url-input" placeholder="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800" class="w-full bg-surface-container-lowest rounded-lg px-space-md py-2.5 text-on-surface font-body-md placeholder:text-outline/50 border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"/>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-space-sm pt-space-sm border-t border-surface-container-high/40 mt-2">
          <button type="button" onclick="closeUploadModal()" class="px-5 py-2.5 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-md text-label-md transition-all cursor-pointer">Cancel</button>
          <button type="submit" id="upload-submit-btn" class="px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
            <span class="material-symbols-outlined text-[18px]">publish</span>
            <span id="upload-btn-text">Publish Video</span>
          </button>
        </div>
      </form>
    </div>
  `;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeUploadModal() {
  const modal = document.getElementById("upload-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.innerHTML = "";
  }
}

function switchUploadMode(mode) {
  currentUploadMode = mode;
  const tabFile = document.getElementById("tab-file-mode");
  const tabUrl = document.getElementById("tab-url-mode");
  const secFile = document.getElementById("file-upload-section");
  const secUrl = document.getElementById("url-upload-section");

  if (mode === "url") {
    if (tabUrl) tabUrl.className = "px-3 py-1 rounded-md bg-primary text-on-primary font-bold shadow-sm transition-all";
    if (tabFile) tabFile.className = "px-3 py-1 rounded-md text-on-surface-variant hover:text-on-surface transition-all";
    if (secFile) { secFile.classList.add("hidden"); secFile.classList.remove("flex"); }
    if (secUrl) { secUrl.classList.remove("hidden"); secUrl.classList.add("flex"); }
  } else {
    if (tabFile) tabFile.className = "px-3 py-1 rounded-md bg-primary text-on-primary font-bold shadow-sm transition-all";
    if (tabUrl) tabUrl.className = "px-3 py-1 rounded-md text-on-surface-variant hover:text-on-surface transition-all";
    if (secUrl) { secUrl.classList.add("hidden"); secUrl.classList.remove("flex"); }
    if (secFile) { secFile.classList.remove("hidden"); secFile.classList.add("flex"); }
  }
}

async function handleVideoUploadSubmit(e) {
  e.preventDefault();

  const title = (document.getElementById("video-title")?.value || "").trim();
  const description = (document.getElementById("video-desc")?.value || "").trim();
  const categoryId = document.getElementById("video-category")?.value || "1";
  const accessType = document.getElementById("video-tier")?.value || "FREE";
  const submitBtn = document.getElementById("upload-submit-btn");
  const btnText = document.getElementById("upload-btn-text");

  if (!title) {
    showUploadError("Title is required");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  if (description) formData.append("description", description);
  formData.append("categoryId", categoryId);
  formData.append("accessType", accessType);
  formData.append("status", "PUBLISHED");
  formData.append("durationSeconds", "0");

  if (currentUploadMode === "file") {
    const videoFileInput = document.getElementById("video-file-input");
    const thumbFileInput = document.getElementById("thumb-file-input");

    const videoFile = videoFileInput?.files?.[0];
    const thumbFile = thumbFileInput?.files?.[0];

    if (!videoFile) {
      showUploadError("Please select a video file (.mp4, .webm, .mkv, .mov)");
      return;
    }

    formData.append("videoFile", videoFile);
    if (thumbFile) {
      formData.append("thumbnailFile", thumbFile);
    } else {
      formData.append("thumbnailUrl", "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800");
    }
  } else {
    const videoUrl = (document.getElementById("video-url-input")?.value || "").trim();
    const thumbUrl = (document.getElementById("thumb-url-input")?.value || "").trim();

    if (!videoUrl) {
      showUploadError("Please enter a valid video stream URL");
      return;
    }

    formData.append("videoUrl", videoUrl);
    formData.append("thumbnailUrl", thumbUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800");
  }

  if (currentUser && currentUser.id) {
    formData.append("creatorId", currentUser.id);
  }

  if (submitBtn) submitBtn.disabled = true;
  if (btnText) btnText.textContent = "Publishing to Skopia Vault...";

  try {
    const res = await fetch("/api/videos", {
      method: "POST",
      body: formData
    });

    if (res.ok) {
      const createdVideo = await res.json().catch(() => null);
      closeUploadModal();
      
      const vId = createdVideo ? (createdVideo.id || createdVideo.videoId) : null;
      addNotification({
        title: "New Video Uploaded",
        message: `"${title}" has been successfully published to the Skopia catalog!`,
        videoId: vId,
        thumbnailUrl: createdVideo ? createdVideo.thumbnailUrl : null
      });

      if (vId) {
        try {
          const known = JSON.parse(localStorage.getItem("skopia_known_video_ids") || "[]");
          if (!known.includes(vId)) {
            known.push(vId);
            localStorage.setItem("skopia_known_video_ids", JSON.stringify(known));
          }
        } catch (e) {}
      }

      await loadVideos();
      navigateTo("home");
    } else {
      let msg = "Failed to upload video.";
      try {
        const err = await res.json();
        msg = err.message || err.error || msg;
      } catch (e) {}
      showUploadError(msg);
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = "Publish Video";
    }
  } catch (err) {
    console.error("Upload error:", err);
    showUploadError("Network error occurred while uploading video.");
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = "Publish Video";
  }
}

function showUploadError(msg) {
  const errBanner = document.getElementById("upload-error-banner");
  const errText = document.getElementById("upload-error-text");
  if (errBanner && errText) {
    errText.textContent = msg;
    errBanner.classList.remove("hidden");
  } else {
    alert(msg);
  }
}

function handlePremiumCardClick(videoId) {
  if (currentUser && currentUser.isPremium) {
    watchVideo(videoId);
  } else if (currentUser) {
    alert("This stream requires a Premium Hub Pass. Click 'Upgrade Pass' to activate!");
  } else {
    alert("Please sign in or register to access subscriber exclusive hubs!");
    navigateTo("login");
  }
}

function watchVideo(videoId) {
  const video = allVideos.find(v => v.id === videoId) || allVideos[0];
  if (video) {
    currentVideo = video;
    navigateTo("watch");
  }
}

function filterFeedByTag(tag) {
  if (tag === "all" || tag === "free") {
    loadVideos();
    return;
  }
  filterByCategory(tag);
}

function filterByCategory(categoryName) {
  const filtered = allVideos.filter(v => (v.category || v.categoryName || '').toLowerCase().includes(categoryName.toLowerCase()));
  if (filtered.length > 0) {
    renderHomeViewWithList(filtered);
  } else {
    renderHomeViewWithList([]);
  }
}

function renderHomeViewWithList(list) {
  const freeGrid = document.getElementById("free-videos-grid");
  if (freeGrid) {
    if (!list || list.length === 0) {
      freeGrid.innerHTML = `
        <div class="col-span-full py-10 px-6 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container/20 text-center flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[30px] text-outline">search_off</span>
          <span class="font-label-md text-label-md text-on-surface font-semibold">No uploaded videos matched this filter</span>
          <button onclick="loadVideos()" class="mt-1 text-primary hover:underline text-label-md font-semibold cursor-pointer">Clear Filter</button>
        </div>
      `;
      return;
    }

    freeGrid.innerHTML = list.map(v => `
      <div class="group flex flex-col gap-3 cursor-pointer" onclick="watchVideo(${v.id})">
        <div class="relative aspect-video rounded-xl overflow-hidden bg-surface-container-low shadow-md group-hover:scale-[1.03] transition-transform duration-200">
          <img class="w-full h-full object-cover" src="${v.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}" alt="${v.title}"/>
          <div class="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 font-label-sm text-label-sm text-on-surface font-semibold">${v.durationFormatted || formatDuration(v.durationSeconds)}</div>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-full bg-surface-container-high shrink-0 flex items-center justify-center font-bold text-primary shadow-sm">
            ${(v.creatorName || 'S').charAt(0).toUpperCase()}
          </div>
          <div class="flex flex-col min-w-0">
            <h3 class="font-headline-sm text-body-lg font-bold text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">${v.title}</h3>
            <div class="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm mt-1">
              <span>${v.creatorName || 'Skopia Creator'}</span>
              <span class="material-symbols-outlined text-[14px] text-primary">verified</span>
            </div>
            <div class="flex items-center gap-1.5 text-outline font-body-sm text-body-sm">
              <span>${(v.viewCount ?? v.viewsCount ?? 0).toLocaleString()} views</span>
              <span>•</span>
              <span class="text-primary font-medium">${v.category || v.categoryName || 'General'}</span>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }
}

// ----------------------------------------------------
// THEATER WATCH PANEL RENDERING
// ----------------------------------------------------

function renderTheaterView() {
  const container = document.getElementById("view-theater");
  if (!container) return;

  const v = currentVideo || (allVideos && allVideos.length > 0 ? allVideos[0] : null);
  if (v) currentVideo = v;

  if (!v) {
    container.innerHTML = `
      <div class="px-space-md lg:px-space-xl py-20 w-full max-w-2xl mx-auto text-center flex flex-col items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary shadow-lg">
          <span class="material-symbols-outlined text-[36px]">movie</span>
        </div>
        <h2 class="text-headline-md font-bold text-on-surface">No Video Selected</h2>
        <p class="text-body-md text-on-surface-variant">There are currently no uploaded videos in playback. Upload a new video or select one from the home feed.</p>
        <div class="flex gap-3 mt-2">
          <button onclick="navigateTo('home')" class="px-6 py-2.5 rounded-full bg-surface-container-high text-on-surface font-label-md hover:bg-surface-container-highest transition-all cursor-pointer">Back to Home</button>
          <button onclick="openUploadModal()" class="px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md hover:bg-primary-container transition-all cursor-pointer">Upload Video</button>
        </div>
      </div>
    `;
    return;
  }

  const otherVideos = allVideos.filter(q => q.id !== v.id);

  container.innerHTML = `
    <div class="px-space-md lg:px-space-xl py-space-md w-full max-w-[1720px] mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        
        <div class="lg:col-span-8 flex flex-col gap-space-lg min-w-0">
          <div class="relative group w-full rounded-2xl overflow-hidden bg-surface-container-lowest shadow-2xl">
            <div class="relative w-full aspect-video bg-black overflow-hidden select-none">
              <video id="html5-video" class="w-full h-full object-contain ${v.videoUrl ? '' : 'hidden'}" src="${v.videoUrl || ''}" controls></video>
              <div id="simulated-poster" class="w-full h-full bg-cover bg-center ${v.videoUrl ? 'hidden' : ''}" style="background-image: url('${v.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1000'}');"></div>
              
              <div class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <button onclick="togglePlay()" class="pointer-events-auto w-20 h-20 rounded-full bg-primary/90 text-on-primary flex items-center justify-center shadow-xl hover:scale-110 transition-all cursor-pointer">
                  <span class="material-symbols-outlined text-[44px] ml-1" id="play-icon" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-space-md">
            <h1 class="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">${v.title}</h1>
            <div class="flex items-center gap-space-sm text-on-surface-variant font-body-sm text-body-sm">
              <span class="text-on-surface font-semibold">${(v.viewCount ?? v.viewsCount ?? 0).toLocaleString()} views</span>
              <span>•</span>
              <span class="text-secondary font-medium">${v.category || v.categoryName || 'Spatial Master'}</span>
              <span>•</span>
              <span class="text-on-surface-variant">${v.accessType === 'PREMIUM' ? 'Hub Pass Exclusive' : 'Public Stream'}</span>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-space-md py-space-sm bg-surface-container-low px-space-md rounded-2xl shadow-sm">
              <div class="flex items-center gap-space-md">
                <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-on-primary shadow-sm">
                  ${(v.creatorName || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div class="font-label-md text-label-md font-bold text-on-surface">${v.creatorName || 'Skopia Creator'}</div>
                  <span class="font-body-sm text-body-sm text-outline">Verified Creator</span>
                </div>
              </div>

              <div class="flex items-center gap-space-xs">
                <button onclick="handleLike()" class="flex items-center gap-1.5 px-space-md py-space-xs rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-pointer">
                  <span class="material-symbols-outlined text-[18px] text-primary" style="font-variation-settings: 'FILL' 1;">thumb_up</span>
                  <span id="like-count">${(v.likeCount ?? v.likesCount ?? 0).toLocaleString()}</span>
                </button>
                <button onclick="openReportModal('video', '${v.title}')" class="p-space-xs rounded-full bg-surface-container-high hover:bg-error-container text-on-surface-variant transition-colors cursor-pointer" title="Report Video">
                  <span class="material-symbols-outlined text-[18px]">flag</span>
                </button>
              </div>
            </div>

            <div class="bg-surface-container-low rounded-2xl p-space-md shadow-md flex flex-col gap-space-sm">
              <span class="font-bold text-on-surface text-label-sm uppercase tracking-wider">Description</span>
              <p class="font-body-md text-body-md text-on-surface leading-relaxed">${v.description || 'No description provided.'}</p>
            </div>

            <!-- Interactive Comments & Discussion Section -->
            <div id="theater-comments-container"></div>
          </div>
        </div>

        <div class="lg:col-span-4 flex flex-col gap-space-md min-w-0">
          <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface">Up Next (Uploaded Videos)</h3>
          <div class="flex flex-col gap-space-sm">
            ${otherVideos.length === 0 ? `
              <div class="p-6 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container/20 text-center text-on-surface-variant text-body-sm">
                No additional uploaded videos in queue.
                <button onclick="openUploadModal()" class="mt-2 block mx-auto text-primary hover:underline font-semibold cursor-pointer">+ Upload another video</button>
              </div>
            ` : otherVideos.map(q => `
              <div class="group relative flex gap-space-sm p-space-xs rounded-xl hover:bg-surface-container transition-all cursor-pointer" onclick="watchVideo(${q.id})">
                <div class="relative w-40 aspect-video rounded-lg overflow-hidden bg-surface-container-lowest flex-shrink-0">
                  <img class="w-full h-full object-cover" src="${q.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}" alt="${q.title}"/>
                  <div class="absolute bottom-1.5 right-1.5 px-1 py-0.2 rounded bg-black/80 font-label-sm text-[10px] text-white">${q.durationFormatted || formatDuration(q.durationSeconds)}</div>
                </div>
                <div class="flex flex-col justify-between py-0.5 min-w-0 flex-1">
                  <h4 class="font-label-md text-label-md font-bold text-on-surface line-clamp-2 group-hover:text-primary transition-colors">${q.title}</h4>
                  <p class="font-body-sm text-body-sm text-outline truncate">${q.creatorName || 'Skopia Creator'}</p>
                  <span class="text-primary font-medium text-[11px]">${q.category || q.categoryName || 'General'}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

      </div>
    </div>
  `;

  loadVideoComments(v);
}

// ----------------------------------------------------
// THEATER COMMENTS & DISCUSSION SYSTEM
// ----------------------------------------------------

let currentComments = [];
let currentCommentSort = 'top'; // 'top' or 'newest'

async function loadVideoComments(video) {
  const container = document.getElementById("theater-comments-container");
  if (!container) return;

  try {
    const res = await fetch(`/api/videos/${video.id}/comments`);
    if (res.ok) {
      const dbComments = await res.json();
      if (Array.isArray(dbComments) && dbComments.length > 0) {
        const commentMap = {};
        const rootComments = [];

        dbComments.forEach(c => {
          commentMap[c.id] = {
            id: c.id,
            authorName: c.displayName || "Viewer",
            avatarUrl: c.avatarUrl || `https://i.pravatar.cc/160?img=${(Math.abs((c.id || 1) % 50) + 1)}`,
            badge: c.badge || (currentUser?.isPremium ? "Music Pass" : null),
            timeAgo: formatTimeAgo(c.postedAt),
            text: c.text,
            likes: c.likeCount || 0,
            isLiked: false,
            isPinned: c.isPinned || false,
            parentId: c.parentId,
            replies: []
          };
        });

        dbComments.forEach(c => {
          if (c.parentId && commentMap[c.parentId]) {
            commentMap[c.parentId].replies.push(commentMap[c.id]);
          } else {
            rootComments.push(commentMap[c.id]);
          }
        });

        currentComments = rootComments;
      } else {
        currentComments = [];
      }
    } else {
      currentComments = [];
    }
  } catch (err) {
    currentComments = [];
  }

  renderCommentsSection();
}

function renderCommentsSection() {
  const container = document.getElementById("theater-comments-container");
  if (!container) return;

  const totalCount = currentComments.reduce((acc, c) => acc + 1 + (c.replies ? c.replies.length : 0), 0);
  const userInitial = currentUser ? (currentUser.displayName || currentUser.username || "U").charAt(0).toUpperCase() : "U";
  const userDisplayName = currentUser ? (currentUser.displayName || currentUser.username) : "Guest";

  container.innerHTML = `
    <div class="bg-surface-container-low rounded-2xl p-space-md lg:p-space-lg shadow-md flex flex-col gap-space-md">
      
      <!-- Comments Header + Sort Filter -->
      <div class="flex items-center justify-between flex-wrap gap-space-sm">
        <div class="flex items-center gap-space-md">
          <h2 class="font-headline-sm text-headline-sm font-bold text-on-surface" id="comment-count-heading">${totalCount === 1 ? '1 Comment' : totalCount.toLocaleString() + ' Comments'}</h2>
          <div class="flex items-center gap-space-xs text-on-surface-variant hover:text-on-surface cursor-pointer font-label-md text-label-md transition-colors select-none" onclick="toggleCommentSort()">
            <span class="material-symbols-outlined text-[18px]">sort</span>
            <span id="comment-sort-label">Sort by: ${currentCommentSort === 'top' ? 'Top Comments' : 'Newest'}</span>
          </div>
        </div>
        <div class="flex items-center gap-space-xs text-outline font-label-sm text-label-sm">
          <span class="material-symbols-outlined text-[16px] text-emerald-400">gavel</span>
          <span>Community Guidelines Active</span>
        </div>
      </div>

      <!-- Add Public Comment Box -->
      <div class="flex gap-space-md items-start pt-space-xs">
        ${currentUser && currentUser.avatarUrl ? `
          <img alt="${userDisplayName}" class="w-10 h-10 rounded-full object-cover shadow-sm ring-1 ring-primary/40 flex-shrink-0" src="${currentUser.avatarUrl}">
        ` : `
          <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-container to-secondary flex items-center justify-center font-bold text-on-primary-container shadow-sm ring-1 ring-primary/40 flex-shrink-0">
            ${userInitial}
          </div>
        `}
        <div class="flex-1 flex flex-col gap-space-sm">
          <textarea id="main-comment-input" class="w-full bg-surface-container-high rounded-xl p-space-sm text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:bg-surface-container-highest transition-all resize-none ring-1 ring-transparent focus:ring-primary/40" placeholder="Add a public comment or praise for the performance..." rows="2"></textarea>
          
          <!-- Quick Emoji Bar -->
          <div id="emoji-picker-bar" class="hidden flex-wrap gap-1.5 p-2 bg-surface-container-highest/80 rounded-lg">
            ${['🎸', '👏', '✨', '🔥', '❤️', '🎵', '🙌', '💯', '🎻', '🎙️'].map(e => `
              <button type="button" class="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center text-lg cursor-pointer transition-transform hover:scale-125" onclick="insertEmoji('${e}')">${e}</button>
            `).join("")}
          </div>

          <div class="flex items-center justify-between">
            <button type="button" onclick="toggleEmojiPicker()" class="flex items-center gap-1 text-outline hover:text-on-surface transition-colors cursor-pointer" title="Add Emoji">
              <span class="material-symbols-outlined text-[18px]">sentiment_satisfied</span>
              <span class="font-label-sm text-label-sm">Emoji</span>
            </button>
            <div class="flex items-center gap-space-xs">
              <button type="button" onclick="cancelCommentInput()" class="px-space-md py-1 rounded-full text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="button" onclick="submitMainComment()" class="px-space-md py-1 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm cursor-pointer">
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Comments Feed -->
      <div class="flex flex-col gap-space-md pt-space-xs" id="comments-feed-list">
        ${renderCommentsFeedHtml()}
      </div>

      ${totalCount > 10 ? `
        <!-- Load More Button -->
        <button class="mt-space-xs py-space-sm rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-md text-label-md font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer" onclick="loadMoreCommentsNotice()">
          <span>Load More Comments</span>
          <span class="material-symbols-outlined text-[16px]">expand_more</span>
        </button>
      ` : ''}

    </div>
  `;
}

function renderCommentsFeedHtml() {
  if (!currentComments || currentComments.length === 0) {
    return `
      <div class="py-12 px-4 rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container/20 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
        <span class="material-symbols-outlined text-[36px] text-outline">chat_bubble_outline</span>
        <span class="font-label-md text-label-md text-on-surface font-semibold">No comments yet</span>
        <span class="font-body-sm text-body-sm text-outline">Be the first to share your thoughts on this broadcast!</span>
      </div>
    `;
  }

  const pinned = currentComments.filter(c => c.isPinned);
  let unpinned = currentComments.filter(c => !c.isPinned);

  if (currentCommentSort === 'top') {
    unpinned.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  }

  const ordered = [...pinned, ...unpinned];
  return ordered.map(c => c.isPinned ? renderPinnedCommentHtml(c) : renderStandardCommentHtml(c)).join("");
}

function renderPinnedCommentHtml(c) {
  return `
    <div class="p-space-md rounded-xl bg-surface-container-high/60 shadow-sm flex flex-col gap-space-xs" id="comment-card-${c.id}">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-space-xs font-label-sm text-label-sm text-amber-300 font-bold">
          <span class="material-symbols-outlined text-[14px]">push_pin</span>
          <span>Pinned by ${c.authorName}</span>
        </div>
        <div class="relative">
          <button class="text-outline hover:text-on-surface p-1 rounded cursor-pointer" onclick="toggleCommentMenu('${c.id}')">
            <span class="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
          <div id="cmenu-${c.id}" class="hidden absolute right-0 top-full mt-1 flex-col bg-surface-container-high rounded-xl p-1 shadow-lg z-20 min-w-[140px] border border-outline-variant/30">
            <button onclick="openReportForComment('${escapeHtml(c.authorName)}', '${escapeHtml(c.text)}')" class="flex items-center gap-1.5 px-2 py-1 text-error text-label-sm font-label-sm hover:bg-surface-container rounded text-left w-full cursor-pointer">
              <span class="material-symbols-outlined text-[14px]">flag</span>
              <span>Report Comment</span>
            </button>
          </div>
        </div>
      </div>
      <div class="flex items-start gap-space-md pt-1">
        <div class="w-9 h-9 rounded-full bg-cover bg-center ring-1 ring-amber-400/50 flex-shrink-0" style="background-image: url('${c.avatarUrl}');"></div>
        <div class="flex-1 flex flex-col gap-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-label-md text-label-md font-bold text-on-surface bg-surface-container-highest px-2 py-0.5 rounded-full flex items-center gap-1">
              ${c.authorName}
              <span class="material-symbols-outlined text-[14px] text-primary">verified</span>
            </span>
            <span class="font-body-sm text-body-sm text-outline">${c.timeAgo}</span>
          </div>
          <p class="font-body-md text-body-md text-on-surface pt-0.5 break-words">
            ${formatCommentText(c.text)}
          </p>
          <div class="flex items-center gap-space-md pt-1 flex-wrap">
            <div class="flex items-center gap-1 text-on-surface-variant text-label-sm font-label-sm select-none">
              <span class="material-symbols-outlined text-[16px] text-primary" style="font-variation-settings: 'FILL' 1;">favorite</span>
              <span class="font-semibold text-primary">Creator Hearted</span>
            </div>
            <div class="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-label-sm font-label-sm cursor-pointer select-none ${c.isLiked ? 'text-primary font-bold' : ''}" onclick="toggleLikeComment('${c.id}')">
              <span class="material-symbols-outlined text-[16px] ${c.isLiked ? 'text-primary' : ''}" style="${c.isLiked ? `font-variation-settings: 'FILL' 1;` : ''}">thumb_up</span>
              <span id="clike-count-${c.id}">${c.likes}</span>
            </div>
            <div class="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-label-sm font-label-sm cursor-pointer select-none">
              <span class="material-symbols-outlined text-[16px]">thumb_down</span>
            </div>
            <button onclick="toggleReplyBox('${c.id}')" class="text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer">Reply</button>
          </div>

          <!-- Inline Reply Box -->
          <div id="reply-container-${c.id}" class="hidden pt-2">
            <div class="flex gap-2 items-center">
              <input id="reply-input-${c.id}" class="flex-1 bg-surface-container-highest rounded-lg px-3 py-1.5 text-body-sm text-on-surface focus:outline-none placeholder:text-outline" placeholder="Reply to ${c.authorName}..."/>
              <button onclick="submitReplyComment('${c.id}')" class="px-3 py-1 rounded-full bg-primary text-on-primary text-label-sm font-semibold hover:bg-primary-container cursor-pointer">Reply</button>
              <button onclick="toggleReplyBox('${c.id}')" class="px-2 py-1 text-on-surface-variant hover:text-on-surface text-label-sm cursor-pointer">Cancel</button>
            </div>
          </div>

          <!-- Replies list -->
          ${c.replies && c.replies.length > 0 ? `
            <div class="flex flex-col gap-2 pt-2 pl-3 border-l-2 border-surface-container-highest mt-2">
              ${c.replies.map(r => `
                <div class="flex items-start gap-2 pt-1">
                  <div class="w-7 h-7 rounded-full bg-cover bg-center flex-shrink-0" style="background-image: url('${r.avatarUrl}');"></div>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-label-sm font-semibold text-on-surface">${r.authorName}</span>
                      <span class="font-body-sm text-[11px] text-outline">${r.timeAgo}</span>
                    </div>
                    <p class="font-body-sm text-on-surface">${formatCommentText(r.text)}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ''}

        </div>
      </div>
    </div>
  `;
}

function renderStandardCommentHtml(c) {
  return `
    <div class="flex items-start gap-space-md" id="comment-card-${c.id}">
      <div class="w-9 h-9 rounded-full bg-cover bg-center flex-shrink-0 ring-1 ring-outline-variant/30" style="background-image: url('${c.avatarUrl}');"></div>
      <div class="flex-1 flex flex-col gap-1 min-w-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-label-md text-label-md font-semibold text-on-surface">${c.authorName}</span>
            <span class="font-body-sm text-body-sm text-outline">${c.timeAgo}</span>
            ${c.badge ? `<span class="px-1.5 py-0.2 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">${c.badge}</span>` : ''}
          </div>
          <div class="relative">
            <button class="text-outline hover:text-on-surface p-1 rounded cursor-pointer" onclick="toggleCommentMenu('${c.id}')">
              <span class="material-symbols-outlined text-[16px]">more_vert</span>
            </button>
            <div id="cmenu-${c.id}" class="hidden absolute right-0 top-full mt-1 flex-col bg-surface-container-high rounded-xl p-1 shadow-lg z-20 min-w-[140px] border border-outline-variant/30">
              <button onclick="openReportForComment('${escapeHtml(c.authorName)}', '${escapeHtml(c.text)}')" class="flex items-center gap-1.5 px-2 py-1 text-error text-label-sm font-label-sm hover:bg-surface-container rounded text-left w-full cursor-pointer">
                <span class="material-symbols-outlined text-[14px]">flag</span>
                <span>Report Comment</span>
              </button>
            </div>
          </div>
        </div>
        <p class="font-body-md text-body-md text-on-surface break-words">
          ${formatCommentText(c.text)}
        </p>
        <div class="flex items-center gap-space-md pt-1 flex-wrap">
          <div class="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-label-sm font-label-sm cursor-pointer select-none ${c.isLiked ? 'text-primary font-bold' : ''}" onclick="toggleLikeComment('${c.id}')">
            <span class="material-symbols-outlined text-[16px] ${c.isLiked ? 'text-primary' : ''}" style="${c.isLiked ? `font-variation-settings: 'FILL' 1;` : ''}">thumb_up</span>
            <span id="clike-count-${c.id}">${c.likes}</span>
          </div>
          <div class="flex items-center gap-1 text-on-surface-variant hover:text-on-surface text-label-sm font-label-sm cursor-pointer select-none">
            <span class="material-symbols-outlined text-[16px]">thumb_down</span>
          </div>
          <button onclick="toggleReplyBox('${c.id}')" class="text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer">Reply</button>
        </div>

        <!-- Inline Reply Box -->
        <div id="reply-container-${c.id}" class="hidden pt-2">
          <div class="flex gap-2 items-center">
            <input id="reply-input-${c.id}" class="flex-1 bg-surface-container-highest rounded-lg px-3 py-1.5 text-body-sm text-on-surface focus:outline-none placeholder:text-outline" placeholder="Reply to ${c.authorName}..."/>
            <button onclick="submitReplyComment('${c.id}')" class="px-3 py-1 rounded-full bg-primary text-on-primary text-label-sm font-semibold hover:bg-primary-container cursor-pointer">Reply</button>
            <button onclick="toggleReplyBox('${c.id}')" class="px-2 py-1 text-on-surface-variant hover:text-on-surface text-label-sm cursor-pointer">Cancel</button>
          </div>
        </div>

        <!-- Replies list -->
        ${c.replies && c.replies.length > 0 ? `
          <div class="flex flex-col gap-2 pt-2 pl-3 border-l-2 border-surface-container-highest mt-2">
            ${c.replies.map(r => `
              <div class="flex items-start gap-2 pt-1">
                <div class="w-7 h-7 rounded-full bg-cover bg-center flex-shrink-0" style="background-image: url('${r.avatarUrl}');"></div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-label-sm font-semibold text-on-surface">${r.authorName}</span>
                    <span class="font-body-sm text-[11px] text-outline">${r.timeAgo}</span>
                  </div>
                  <p class="font-body-sm text-on-surface">${formatCommentText(r.text)}</p>
                </div>
              </div>
            `).join("")}
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

async function submitMainComment() {
  const targetVideo = currentVideo || (allVideos && allVideos.length > 0 ? allVideos[0] : null);
  if (!targetVideo) return;
  currentVideo = targetVideo;

  const input = document.getElementById("main-comment-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  const author = currentUser ? (currentUser.displayName || currentUser.username) : "Community Member";
  const avatar = currentUser?.avatarUrl || "https://lh3.googleusercontent.com/aida/AEtjO1XdfrpZm-eIDF-UboqSB3t3Vg8Y-LIYsdSmRD4W-hGglwahLXiQLA6REjHSFEjt-L2YJpbbZQnK_Ce19ep64Y1SOWNWKxvb8HplgjRzl-FGNQoMJClQFR2t4VdLYkGAw57P72lRh1OHE9GTcpmM-ICicIkxvb0eN9lZixcsS2rqKxBPckxtHZuJm0vsdDaaptb_nAv04MYNqgoBtW4TIjXNBiYFAmXw5kT2JD2eWTZvYdL316Hixawz5lQ";
  const badge = currentUser?.isPremium ? "Music Pass" : (currentUser ? "Viewer" : null);

  const newCommentObj = {
    id: "local-" + Date.now(),
    authorName: author,
    avatarUrl: avatar,
    badge: badge,
    isVerified: currentUser?.roleType === "CONTENT_CREATOR",
    isPinned: false,
    timeAgo: "Just now",
    text: text,
    likes: 0,
    isLiked: false,
    replies: []
  };

  currentComments.unshift(newCommentObj);
  input.value = "";
  const emojiBar = document.getElementById("emoji-picker-bar");
  if (emojiBar) emojiBar.classList.add("hidden");
  renderCommentsSection();

  showGlobalNotification("Comment Posted", "Your comment has been published to the broadcast discussion.", "mode_comment");

  try {
    const effectiveViewerId = currentUser?.id ? currentUser.id : 1;
    const res = await fetch(`/api/videos/${targetVideo.id}/comments?viewerId=${effectiveViewerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        parentId: null,
        authorName: author,
        avatarUrl: avatar
      })
    });
    if (res.ok) {
      const saved = await res.json();
      if (saved && saved.id) {
        newCommentObj.id = saved.id;
      }
    }
  } catch (err) {
    console.warn("Server comment save notice", err);
  }
}

function cancelCommentInput() {
  const input = document.getElementById("main-comment-input");
  if (input) input.value = "";
  const emojiBar = document.getElementById("emoji-picker-bar");
  if (emojiBar) emojiBar.classList.add("hidden");
}

async function submitReplyComment(parentId) {
  const targetVideo = currentVideo || (allVideos && allVideos.length > 0 ? allVideos[0] : null);
  if (!targetVideo) return;
  currentVideo = targetVideo;

  const input = document.getElementById(`reply-input-${parentId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  const author = currentUser ? (currentUser.displayName || currentUser.username) : "Community Member";
  const avatar = currentUser?.avatarUrl || "https://lh3.googleusercontent.com/aida/AEtjO1XdfrpZm-eIDF-UboqSB3t3Vg8Y-LIYsdSmRD4W-hGglwahLXiQLA6REjHSFEjt-L2YJpbbZQnK_Ce19ep64Y1SOWNWKxvb8HplgjRzl-FGNQoMJClQFR2t4VdLYkGAw57P72lRh1OHE9GTcpmM-ICicIkxvb0eN9lZixcsS2rqKxBPckxtHZuJm0vsdDaaptb_nAv04MYNqgoBtW4TIjXNBiYFAmXw5kT2JD2eWTZvYdL316Hixawz5lQ";

  const replyObj = {
    id: "reply-" + Date.now(),
    authorName: author,
    avatarUrl: avatar,
    timeAgo: "Just now",
    text: text
  };

  const parent = currentComments.find(c => String(c.id) === String(parentId));
  if (parent) {
    if (!parent.replies) parent.replies = [];
    parent.replies.push(replyObj);
  }

  renderCommentsSection();
  showGlobalNotification("Reply Posted", `You replied to ${parent?.authorName || 'comment'}.`, "reply");

  try {
    const numericParentId = typeof parentId === "number" ? parentId : null;
    const effectiveViewerId = currentUser?.id ? currentUser.id : 1;
    await fetch(`/api/videos/${targetVideo.id}/comments?viewerId=${effectiveViewerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        parentId: numericParentId,
        authorName: author,
        avatarUrl: avatar
      })
    });
  } catch (err) {
    console.warn("Server reply save notice", err);
  }
}

function toggleReplyBox(commentId) {
  const box = document.getElementById(`reply-container-${commentId}`);
  if (box) {
    box.classList.toggle("hidden");
    if (!box.classList.contains("hidden")) {
      const inp = document.getElementById(`reply-input-${commentId}`);
      if (inp) inp.focus();
    }
  }
}

function toggleLikeComment(commentId) {
  const c = currentComments.find(q => String(q.id) === String(commentId));
  if (!c) return;
  c.isLiked = !c.isLiked;
  c.likes = c.isLiked ? (c.likes + 1) : Math.max(0, c.likes - 1);
  renderCommentsSection();
}

function toggleCommentMenu(commentId) {
  const menu = document.getElementById(`cmenu-${commentId}`);
  if (menu) {
    menu.classList.toggle("hidden");
    menu.classList.toggle("flex");
  }
}

function toggleCommentSort() {
  currentCommentSort = currentCommentSort === 'top' ? 'newest' : 'top';
  renderCommentsSection();
}

function toggleEmojiPicker() {
  const bar = document.getElementById("emoji-picker-bar");
  if (bar) {
    bar.classList.toggle("hidden");
    bar.classList.toggle("flex");
  }
}

function insertEmoji(emoji) {
  const input = document.getElementById("main-comment-input");
  if (input) {
    input.value += emoji;
    input.focus();
  }
}

function openReportForComment(author, text) {
  document.querySelectorAll("[id^='cmenu-']").forEach(el => {
    el.classList.add("hidden");
    el.classList.remove("flex");
  });
  openReportModal('comment', `Comment by ${author}: "${text.substring(0, 50)}..."`);
}

function openReportModal(type = 'video', targetDetails = '') {
  const modal = document.getElementById("report-modal");
  if (!modal) return;
  const titleEl = document.getElementById("report-modal-title");
  const targetInput = document.getElementById("report-target-input");
  const reasonSelect = document.getElementById("report-reason");

  if (type === 'comment') {
    if (titleEl) titleEl.textContent = "Report Comment or Discussion";
    if (reasonSelect) reasonSelect.value = "Inappropriate or Offensive Material";
    if (targetInput) targetInput.value = targetDetails || "Flagged User Comment";
  } else {
    if (titleEl) titleEl.textContent = "Report Video or Playback Issue";
    if (reasonSelect) reasonSelect.value = "Copyright or Licensing Infringement";
    if (targetInput) targetInput.value = targetDetails || (currentVideo ? currentVideo.title : "Stream Content");
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeReportModal() {
  const modal = document.getElementById("report-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function handleReportSubmit(e) {
  if (e) e.preventDefault();
  closeReportModal();
  showGlobalNotification("Report Submitted", "Your compliance ticket was submitted to the moderation desk.", "verified_user");
}

function loadMoreCommentsNotice() {
  showGlobalNotification("Discussion Feed", "All active comments for this broadcast session are currently displayed.", "forum");
}

function formatCommentText(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  return escaped.replace(/\b(\d{1,2}):(\d{2})\b/g, (match, min, sec) => {
    return `<a class="text-primary hover:underline font-mono cursor-pointer font-semibold" onclick="seekVideoTime(${parseInt(min, 10)}, ${parseInt(sec, 10)})">${match}</a>`;
  });
}

function seekVideoTime(min, sec) {
  const video = document.getElementById("html5-video");
  if (video) {
    video.currentTime = min * 60 + sec;
    video.play();
    isPlaying = true;
    const playIcon = document.getElementById("play-icon");
    if (playIcon) playIcon.textContent = "pause";
  }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  } catch (e) {
    return "Recently";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function togglePlay() {
  const html5Video = document.getElementById("html5-video");
  const playIcon = document.getElementById("play-icon");
  if (html5Video && !html5Video.classList.contains("hidden")) {
    if (html5Video.paused) {
      html5Video.play();
      isPlaying = true;
    } else {
      html5Video.pause();
      isPlaying = false;
    }
  } else {
    isPlaying = !isPlaying;
  }
  if (playIcon) playIcon.textContent = isPlaying ? "pause" : "play_arrow";
}

async function handleLike() {
  if (!currentVideo) return;
  const countEl = document.getElementById("like-count");
  try {
    const res = await fetch(`/api/videos/${currentVideo.id}/like?viewerId=${currentUser ? currentUser.id : 1}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (countEl) countEl.textContent = (data.likesCount || (currentVideo.likesCount + 1)).toLocaleString();
    }
  } catch (err) {
    if (countEl) countEl.textContent = (currentVideo.likesCount + 1).toLocaleString();
  }
}

// ----------------------------------------------------
// USER MANAGEMENT & LOGIN VIEWS
// ----------------------------------------------------

function renderAdminView() {
  loadAdminStats();
  loadUsersList();
}

function renderLoginView() {
  // Login form rendered via index.html structure
}

async function loadAdminStats() {
  try {
    const res = await fetch("/api/admin/users/stats");
    if (res.ok) {
      const stats = await res.json();
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setVal("stat-total-users", stats.totalUsers || 0);
      setVal("stat-active-users", stats.activeUsers || 0);
      setVal("stat-suspended-users", (stats.suspendedUsers || 0) + (stats.blockedUsers || 0));
      setVal("stat-premium-viewers", stats.premiumViewers || 0);
      setVal("stat-creators", stats.totalCreators || 0);
      setVal("stat-staff-total", stats.totalStaff || 0);
    }
  } catch (err) {}
}

async function loadUsersList() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  try {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const users = await res.json();
      renderUsersTable(users);
    } else {
      renderFallbackUsersTable();
    }
  } catch (err) {
    renderFallbackUsersTable();
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-space-xl text-center text-outline font-body-md">No platform users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const roleType = u.roleType || u.userType || "REGISTERED_VIEWER";
    const status = u.accountStatus || "ACTIVE";
    const statusColor = status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300" : "bg-error-container text-on-error-container";
    const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
    const initial = name.charAt(0).toUpperCase();

    return `
      <tr class="hover:bg-surface-container-high/40 transition-colors">
        <td class="py-space-md px-space-lg flex items-center gap-space-sm">
          <div class="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center font-bold text-on-primary-container shadow-sm">${initial}</div>
          <div class="flex flex-col">
            <span class="font-label-md text-label-md font-bold text-on-surface">${name}</span>
            <span class="font-body-sm text-body-sm text-outline">${u.email}</span>
          </div>
        </td>
        <td class="py-space-md px-space-md">
          <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold">${roleType}</span>
        </td>
        <td class="py-space-md px-space-md">
          <span class="px-2 py-0.5 rounded-full ${statusColor} font-label-sm text-label-sm font-bold uppercase tracking-wider">${status}</span>
        </td>
        <td class="py-space-md px-space-md">
          <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-outline font-label-sm text-label-sm">${u.isPremium ? 'Music Pass' : 'Free Tier'}</span>
        </td>
        <td class="py-space-md px-space-md text-on-surface-variant font-mono text-body-sm">
          ${u.registeredDate ? new Date(u.registeredDate).toLocaleDateString() : '2026-09-20'}
        </td>
        <td class="py-space-md px-space-lg text-right">
          <button onclick="openStatusModal(${u.id}, '${u.username}', '${status}')" class="px-space-md py-1 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm cursor-pointer">
            Manage Status
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderFallbackUsersTable() {
  renderUsersTable([
    { id: 1, username: "nethmi", email: "nethmi@skopia.media", firstName: "Nethmi", lastName: "Perera", roleType: "REGISTERED_VIEWER", accountStatus: "ACTIVE", isPremium: true },
    { id: 2, username: "starlight_admin", email: "admin@starlight.lk", firstName: "Starlight", lastName: "Admin", roleType: "ADMINISTRATOR", accountStatus: "ACTIVE", isPremium: true },
    { id: 3, username: "senuri_official", email: "senuri@skopia.media", firstName: "Senuri", lastName: "Official", roleType: "CONTENT_CREATOR", accountStatus: "ACTIVE", isVerified: true }
  ]);
}

// ----------------------------------------------------
// GLOBAL SEARCH
// ----------------------------------------------------

function setupGlobalSearch() {
  const input = document.getElementById("globalSearch");
  if (!input) return;

  input.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderHomeView();
      return;
    }
    const filtered = allVideos.filter(v =>
      v.title.toLowerCase().includes(q) ||
      (v.description && v.description.toLowerCase().includes(q)) ||
      (v.creatorName && v.creatorName.toLowerCase().includes(q)) ||
      ((v.category || v.categoryName) && (v.category || v.categoryName).toLowerCase().includes(q))
    );
    renderHomeViewWithList(filtered);
  });
}
