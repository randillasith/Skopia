package org.gp14.skopia.mail;

import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import java.util.regex.Pattern;

/** Strict single mailbox; disallow display names, delimiters, controls and SMTP header injection. */
public final class BillingMailAddress {
    private static final Pattern MAILBOX = Pattern.compile(
            "[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}");
    private BillingMailAddress() {}

    public static boolean valid(String value) {
        if (value == null || value.length() > 254 || !MAILBOX.matcher(value).matches()
                || value.startsWith(".") || value.contains("..") || value.substring(0, value.indexOf('@')).endsWith(".")) return false;
        try {
            InternetAddress address = new InternetAddress(value, true);
            address.validate();
            return value.equals(address.getAddress()) && address.getPersonal() == null;
        } catch (AddressException ex) {
            return false;
        }
    }
}
