package org.gp14.skopia.advertising;

import org.springframework.http.HttpStatus;

/**
 * A refusal the advertising module can explain to the person who caused it.
 *
 * <p>Carries the status with it so the message and the code are decided in one
 * place — the service that knows why — rather than being reconstructed from a
 * string in the controller.
 */
public class AdvertisingException extends RuntimeException {

    private final HttpStatus status;

    public AdvertisingException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static AdvertisingException notFound(String what, Object id) {
        return new AdvertisingException(HttpStatus.NOT_FOUND, what + " " + id + " does not exist.");
    }

    public static AdvertisingException invalid(String message) {
        return new AdvertisingException(HttpStatus.BAD_REQUEST, message);
    }

    public static AdvertisingException forbidden(String message) {
        return new AdvertisingException(HttpStatus.FORBIDDEN, message);
    }

    public static AdvertisingException conflict(String message) {
        return new AdvertisingException(HttpStatus.CONFLICT, message);
    }
}
