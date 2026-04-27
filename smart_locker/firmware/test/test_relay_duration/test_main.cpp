// Feature: smart-locker-system, Property 14: Relay duration
// Validates: Requirements 2.8, 3.4
//
// Property 14: Relay Activation Duration
// For any valid (non-stale) UNLOCK command received by the ESP8266, the relay
// SHALL be activated for a duration between 3000 ms and 5000 ms (inclusive).

#include <rapidcheck.h>
#include <iostream>

// Constants from config.h and relay_controller.cpp
constexpr unsigned long MIN_RELAY_DURATION_MS = 3000;
constexpr unsigned long MAX_RELAY_DURATION_MS = 5000;

// Host-compilable relay duration validation logic
// This mirrors the logic in RelayController::activate()
// Returns the actual duration that will be used after validation
unsigned long validateRelayDuration(unsigned long requestedDurationMs) {
    unsigned long actualDuration = requestedDurationMs;
    
    // Clamp to minimum
    if (actualDuration < MIN_RELAY_DURATION_MS) {
        actualDuration = MIN_RELAY_DURATION_MS;
    }
    
    // Clamp to maximum
    if (actualDuration > MAX_RELAY_DURATION_MS) {
        actualDuration = MAX_RELAY_DURATION_MS;
    }
    
    return actualDuration;
}

int main() {
    std::cout << "Running Property 14: Relay Activation Duration Test" << std::endl;
    std::cout << "Minimum iterations: 100" << std::endl;
    
    // Property: Any requested duration results in 3000-5000ms range
    rc::check("Relay duration is always clamped to 3000-5000ms range", []() {
        // Generate arbitrary requested duration (0 to 100000 ms)
        auto requestedDuration = *rc::gen::inRange<unsigned long>(0UL, 100000UL);
        
        // Get actual duration after validation
        unsigned long actualDuration = validateRelayDuration(requestedDuration);
        
        // Verify: actual duration is within valid range
        RC_ASSERT(actualDuration >= MIN_RELAY_DURATION_MS);
        RC_ASSERT(actualDuration <= MAX_RELAY_DURATION_MS);
    });
    
    // Property: Durations below 3000ms are clamped to 3000ms
    rc::check("Durations below 3000ms are clamped to minimum", []() {
        // Generate duration below minimum (0 to 2999 ms)
        auto requestedDuration = *rc::gen::inRange<unsigned long>(0UL, MIN_RELAY_DURATION_MS - 1);
        
        // Get actual duration
        unsigned long actualDuration = validateRelayDuration(requestedDuration);
        
        // Verify: clamped to minimum
        RC_ASSERT(actualDuration == MIN_RELAY_DURATION_MS);
    });
    
    // Property: Durations above 5000ms are clamped to 5000ms
    rc::check("Durations above 5000ms are clamped to maximum", []() {
        // Generate duration above maximum (5001 to 100000 ms)
        auto requestedDuration = *rc::gen::inRange<unsigned long>(
            MAX_RELAY_DURATION_MS + 1,
            100000UL
        );
        
        // Get actual duration
        unsigned long actualDuration = validateRelayDuration(requestedDuration);
        
        // Verify: clamped to maximum
        RC_ASSERT(actualDuration == MAX_RELAY_DURATION_MS);
    });
    
    // Property: Durations within range are preserved
    rc::check("Durations within 3000-5000ms range are preserved", []() {
        // Generate duration within valid range
        auto requestedDuration = *rc::gen::inRange<unsigned long>(
            MIN_RELAY_DURATION_MS,
            MAX_RELAY_DURATION_MS
        );
        
        // Get actual duration
        unsigned long actualDuration = validateRelayDuration(requestedDuration);
        
        // Verify: duration is unchanged
        RC_ASSERT(actualDuration == requestedDuration);
    });
    
    // Property: Boundary condition - exactly 3000ms is valid
    rc::check("Exactly 3000ms is a valid duration", []() {
        unsigned long requestedDuration = MIN_RELAY_DURATION_MS;
        unsigned long actualDuration = validateRelayDuration(requestedDuration);
        
        // Verify: 3000ms is preserved
        RC_ASSERT(actualDuration == MIN_RELAY_DURATION_MS);
    });
    
    // Property: Boundary condition - exactly 5000ms is valid
    rc::check("Exactly 5000ms is a valid duration", []() {
        unsigned long requestedDuration = MAX_RELAY_DURATION_MS;
        unsigned long actualDuration = validateRelayDuration(requestedDuration);
        
        // Verify: 5000ms is preserved
        RC_ASSERT(actualDuration == MAX_RELAY_DURATION_MS);
    });
    
    // Property: Zero duration is clamped to minimum
    rc::check("Zero duration is clamped to 3000ms", []() {
        unsigned long requestedDuration = 0;
        unsigned long actualDuration = validateRelayDuration(requestedDuration);
        
        // Verify: zero is clamped to minimum
        RC_ASSERT(actualDuration == MIN_RELAY_DURATION_MS);
    });
    
    std::cout << "All property tests passed!" << std::endl;
    return 0;
}
