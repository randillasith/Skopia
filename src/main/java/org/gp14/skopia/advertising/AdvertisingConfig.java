package org.gp14.skopia.advertising;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on the scheduler that {@link AdExpiryJob} runs under.
 *
 * <p>Kept in the advertising package rather than on the application class: FR5 is
 * the only feature that schedules anything today, and a module that needs a
 * platform-wide switch flipped should be the one that flips it.
 */
@Configuration
@EnableScheduling
public class AdvertisingConfig {
}
