// API Service for Skopia Backend Integration
const API_BASE_URL = 'http://localhost:8082/api';

class SkopiaAPIService {

    // ===== User Management APIs =====

    static async registerUser(data) {
        return fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(r => r.json());
    }

    static async loginUser(emailOrUsername, password) {
        return fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrUsername, password })
        }).then(r => r.json());
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
