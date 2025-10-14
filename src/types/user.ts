// User interface
export interface User {
    _id?: string;
    username: string;
    fullname: string,
    email: string;
    password: string;
    verified: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface RegisterRequest {
    username: string;
    fullname: string
    email: string;
    password: string;
    confirmPassword: string;
}