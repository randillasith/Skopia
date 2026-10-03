package org.gp14.skopia.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @org.springframework.beans.factory.annotation.Value("${skopia.ads.media.storage-dir:uploads/ads}")
    private String adsDirectory;

    // Only advertising assets retain static handling; video assets must pass the media controller.
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        java.nio.file.Path ads = java.nio.file.Path.of(adsDirectory).toAbsolutePath().normalize();
        String location = ads.toUri().toString();
        registry.addResourceHandler("/uploads/ads/**").addResourceLocations(location.endsWith("/") ? location : location + "/");
    }
}
