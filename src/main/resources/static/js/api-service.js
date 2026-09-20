// API Service for Skopia Backend Integration
const API_BASE_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http'))
    ? `${window.location.origin}/api`
    : 'http://localhost:8082/api';

class SkopiaAPIService {

    // ===== User Authentication & Registration APIs =====

    static async checkHandle(handle) {
        try {
            const clean = (handle || '').trim();
            const res = await fetch(`${API_BASE_URL}/auth/check-handle?handle=${encodeURIComponent(clean)}`);
            if (!res.ok) throw new Error('Handle check failed');
            return await res.json();
        } catch (e) {
            console.warn('Check handle error:', e);
            return { handle, available: true };
        }
    }

    static async registerUser(data) {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json().catch(() => ({ message: 'Server response could not be parsed' }));
        return { ok: res.ok, status: res.status, ...json };
    }

    static async loginUser(emailOrUsername, password) {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: emailOrUsername, emailOrUsername, password })
        });
        const json = await res.json().catch(() => ({ message: 'Login failed' }));
        return { ok: res.ok, status: res.status, ...json };
    }

    static async getUserProfile(userId) {
        return fetch(`${API_BASE_URL}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(r => r.json());
    }

    static async updateProfile(userId, data) {
        return fetch(`${API_BASE_URL}/users/${userId}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        }).then(r => r.json());
    }

    static async changePassword(userId, data) {
        return fetch(`${API_BASE_URL}/users/${userId}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        }).then(r => r.json());
    }

    static async deactivateUser(userId) {
        return fetch(`${API_BASE_URL}/users/${userId}/deactivate`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(r => r.json());
    }

    static async getAllUsers() {
        return fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(r => r.json());
    }

    // ===== Session Management =====

    static setToken(token) {
        localStorage.setItem('token', token);
    }

    static getToken() {
        return localStorage.getItem('token');
    }

    static setCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    static getCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }

    static clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
    }

    static isLoggedIn() {
        return !!this.getToken();
    }
}
