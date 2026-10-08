package org.gp14.skopia.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.gp14.skopia.model.user.User;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Set;

@RestController @RequestMapping("/api/billing")
public class SimulatedOrderController {
    private final SimulatedOrderService orders;
    private final ObjectMapper mapper;
    public SimulatedOrderController(SimulatedOrderService orders,ObjectMapper mapper) { this.orders=orders; this.mapper=mapper; }

    @PostMapping("/orders/card-preview") @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.OrderView card(@AuthenticationPrincipal User user,@RequestBody JsonNode body) {
        exact(body,Set.of("planName","brand","billing"),Set.of());
        return orders.card(id(user),string(body,"planName"),string(body,"brand"),contact(body.get("billing")));
    }
    @PostMapping("/orders/no-charge-card") @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.OrderView noChargeCard(@AuthenticationPrincipal User user,@RequestBody JsonNode body) {
        exact(body,Set.of("planName","brand","billing"),Set.of());
        return orders.noChargeCard(id(user),string(body,"planName"),string(body,"brand"),contact(body.get("billing")));
    }
    @PostMapping(value="/orders/bank-transfer",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public BillingDtos.OrderView bank(@AuthenticationPrincipal User user,@RequestParam String planName,
            @RequestParam String billing,@RequestParam(required=false) String reference,
            @RequestPart("slip") MultipartFile slip,jakarta.servlet.http.HttpServletRequest request) {
        if(!request.getParameterMap().keySet().stream()
                .allMatch(key->Set.of("planName","billing","reference").contains(key)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unexpected form field");
        try { return orders.bank(id(user),planName,contact(mapper.readTree(billing)),reference,slip); }
        catch(com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid billing JSON");
        }
    }
    @GetMapping("/orders") public List<BillingDtos.OrderView> mine(@AuthenticationPrincipal User user) {
        return orders.ownerOrders(id(user));
    }
    @GetMapping("/admin/orders") public List<BillingDtos.OrderView> admin(@AuthenticationPrincipal User user) {
        return orders.adminOrders(user);
    }
    @GetMapping("/admin/orders/{id}/slip") public ResponseEntity<byte[]> slip(@AuthenticationPrincipal User user,@PathVariable Long id) {
        byte[] bytes=orders.slip(user,id);
        String type=orders.slipType(user,id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(type))
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=sample-slip")
                .header(HttpHeaders.CACHE_CONTROL,"no-store")
                .header("X-Content-Type-Options","nosniff").body(bytes);
    }
    @PostMapping("/admin/orders/{id}/decision")
    public BillingDtos.OrderView decide(@AuthenticationPrincipal User user,@PathVariable Long id,@RequestBody JsonNode body) {
        exact(body,Set.of("decision"),Set.of("note"));
        return orders.decide(user,id,string(body,"decision"),body.has("note")?string(body,"note"):null);
    }
    private BillingDtos.BillingContact contact(JsonNode b) {
        exact(b,Set.of("fullName","email","phone","addressLine1","city","postalCode","country"),Set.of("addressLine2"));
        return new BillingDtos.BillingContact(string(b,"fullName"),string(b,"email"),string(b,"phone"),
                string(b,"addressLine1"),b.has("addressLine2")?string(b,"addressLine2"):null,
                string(b,"city"),string(b,"postalCode"),string(b,"country"));
    }
    private void exact(JsonNode b,Set<String> required,Set<String> optional) {
        if(b==null || !b.isObject() || !java.util.stream.StreamSupport.stream(
                java.util.Spliterators.spliteratorUnknownSize(b.fieldNames(),0),false)
                .allMatch(key->required.contains(key)||optional.contains(key))
                || !required.stream().allMatch(b::has)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid order fields");
    }
    private String string(JsonNode b,String key) {
        if(!b.has(key)||!b.get(key).isTextual()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid "+key);
        return b.get(key).asText();
    }
    private Long id(User user) { if(user==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED); return user.getId(); }
}
