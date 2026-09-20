package org.gp14.skopia.web;

import java.io.IOException;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the React bundle and makes client-side routing survive a page refresh.
 *
 * <p>The UI owns its routes in the browser, so a path such as {@code /studio/analytics}
 * has no file behind it. Without this, opening that URL directly, refreshing the page
 * or following a bookmark would return a 404 from Spring rather than the application.
 *
 * <p>The resolver serves a real file whenever one exists and otherwise falls back to
 * {@code index.html}, letting React Router take over. See {@link #NO_FALLBACK} for the
 * paths deliberately left out of that fallback.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {

    private static final String STATIC_ROOT = "classpath:/static/";
    private static final String INDEX = "/static/index.html";

    /**
     * Paths that must answer 404 when nothing is there, rather than falling back
     * to the page. {@code api} so an unknown endpoint stays an API error instead of
     * returning HTML, and {@code assets} because those filenames carry a content
     * hash: after a deploy, a browser holding a cached index.html asks for the
     * previous bundle, and answering with HTML surfaces as "Unexpected token '<'"
     * in the console instead of an honest missing file.
     */
    private static final String[] NO_FALLBACK = { "api/", "assets/" };

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC_ROOT)
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location)
                            throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        for (String prefix : NO_FALLBACK) {
                            if (resourcePath.startsWith(prefix)) {
                                return null;
                            }
                        }
                        return new ClassPathResource(INDEX);
                    }
                });
    }
}
