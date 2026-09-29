package com.skopia;

final class ApiException extends RuntimeException {
    private final int status;

    ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    int status() { return status; }

    static ApiException unauthorized() { return new ApiException(401, "Please sign in to continue"); }
    static ApiException forbidden(String message) { return new ApiException(403, message); }
}
