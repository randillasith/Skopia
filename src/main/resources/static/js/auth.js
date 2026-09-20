// Authentication Manager for Skopia

class AuthManager {

    static async login(emailOrUsername, password) {
        try {
            const response = await SkopiaAPIService.loginUser(emailOrUsername, password);

            if (response.message && response.message.includes('successful')) {
                SkopiaAPIService.setToken(response.token);
                SkopiaAPIService.setCurrentUser({
                    userId: response.userId,
                    username: response.username,
                    email: response.email,
                    firstName: response.firstName,
                    lastName: response.lastName,
                    accountStatus: response.accountStatus
                });

                // Update UI
                this.updateProfileUI(response);
                return { success: true, message: 'Login successful' };
            } else {
                return { success: false, message: response.message };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed' };
        }
    }

    static async register(data) {
        try {
            const response = await SkopiaAPIService.registerUser(data);

            if (response.message && response.message.includes('successfully')) {
                return { success: true, message: 'Registration successful', data: response };
            } else {
                return { success: false, message: response.message };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Registration failed' };
        }
    }

    static logout() {
        SkopiaAPIService.clearSession();
        this.updateProfileUI(null);
        window.location.href = '/login.html';
    }

    static updateProfileUI(user) {
        const profileBtn = document.querySelector('[data-profile-btn]');
        const profileImg = document.querySelector('[data-profile-img]');

        if (user) {
            // User is logged in
            if (profileImg) {
                profileImg.style.display = 'block';
            }

            // Setup profile dropdown
            this.setupProfileDropdown(user);
        } else {
            // User is logged out
            if (profileImg) {
                profileImg.style.display = 'none';
            }
            this.setupLoginState();
        }
    }

    static setupProfileDropdown(user) {
        const profileBtn = document.querySelector('[data-profile-btn]');
        if (!profileBtn) return;

        profileBtn.innerHTML = `
            <img alt="Profile" class="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAch1h6e13lTkVvAi5NNwWZ8MX9a1EB9nRAa71JSIHUxrQI-EaUGh8G4aSWadpLvjjQbX5vZHkJKc3QZ4PFkLdk98kLBTaGDG9VgxycL0FdyRgH80RT0IRwHlt-MnHL-Ttwa5GIRqOoiYdFXiZe4psEuZJ8zLK1Fnsy515UgfRuAl6E_JgvNdwTyso5Y5JDVo66L7t7ZfHpGyD_zCVLRhaY0eC5CoKa5nGModg3tuVPJcaTnw4Dwh7dGw">
            <span class="material-symbols-outlined text-on-surface-variant text-[18px] hidden lg:block">expand_more</span>
        `;

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'hidden absolute right-0 mt-2 w-48 bg-surface-container-highest rounded-lg shadow-lg z-50';
        dropdown.innerHTML = `
            <div class="p-4 border-b border-surface-container-high">
                <div class="font-label-md text-label-md text-on-surface font-semibold">${user.firstName} ${user.lastName}</div>
                <div class="font-body-sm text-body-sm text-on-surface-variant">${user.email}</div>
            </div>
            <div class="py-2">
                <button class="w-full text-left px-4 py-2 hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-2" onclick="window.location.href='/profile.html'">
                    <span class="material-symbols-outlined text-[16px]">person</span>
                    My Profile
                </button>
                <button class="w-full text-left px-4 py-2 hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-2" onclick="window.location.href='/account-settings.html'">
                    <span class="material-symbols-outlined text-[16px]">settings</span>
                    Account Settings
                </button>
                <button class="w-full text-left px-4 py-2 hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-2" onclick="window.location.href='/watchlist.html'">
                    <span class="material-symbols-outlined text-[16px]">bookmark</span>
                    Watchlist
                </button>
                <div class="border-t border-surface-container-high my-2"></div>
                <button class="w-full text-left px-4 py-2 hover:bg-error/20 text-error font-label-sm text-label-sm flex items-center gap-2" onclick="AuthManager.logout()">
                    <span class="material-symbols-outlined text-[16px]">logout</span>
                    Sign Out
                </button>
            </div>
        `;

        profileBtn.parentElement.insertBefore(dropdown, profileBtn.nextSibling);

        // Toggle dropdown on click
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });
    }

    static setupLoginState() {
        const profileBtn = document.querySelector('[data-profile-btn]');
        if (!profileBtn) return;

        profileBtn.innerHTML = `
            <span class="font-label-md text-label-md text-primary">Sign In</span>
        `;

        profileBtn.onclick = () => {
            window.location.href = '/login.html';
        };
    }

    static init() {
        if (SkopiaAPIService.isLoggedIn()) {
            const currentUser = SkopiaAPIService.getCurrentUser();
            this.updateProfileUI(currentUser);
        } else {
            this.setupLoginState();
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AuthManager.init();
});
