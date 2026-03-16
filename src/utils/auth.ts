import { User } from '../App';

const USERS_KEY = 'safai_users';

export const register = (user: User): boolean => {
    const users = getUsers();
    if (users.find((u) => u.email === user.email)) {
        return false; // User already exists
    }
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
};

export const login = (email: string): User | null => {
    const users = getUsers();
    return users.find((u) => u.email === email) || null;
};

export const getUsers = (): User[] => {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};
