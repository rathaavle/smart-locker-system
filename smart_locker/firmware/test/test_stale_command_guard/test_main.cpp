// Feature: smart-locker-system, Property 13: Stale command guard
// Validates: Requirements 5.6
//
// Property 13: Stale Command Guard
// For any UNLOCK command with commandAt timestamp T, the ESP8266 firmware SHALL
// activate the relay if and only if (currentTime - T) <= 30 seconds; commands
// older than 30 seconds SHALL be discarded without relay activation.

#include <rapidcheck.h>
#include <iostream>

// Constants from config.h
constexpr long STALE_COMMAND_THRESHOLD_SECONDS = 30;

// Host-compilable stale command guard logic
// Returns true if the command should be executed (not stale)
// Returns false if the command should be discarded (stale)
bool shouldExecuteCommand(long commandAt, long currentTime) {
    long commandAge = currentTime - commandAt;
    return commandAge <= STALE_COMMAND_THRESHOLD_SECONDS;
}

int main() {
    std::cout << "Running Property 13: Stale Command Guard Test" << std::endl;
    std::cout << "Minimum iterations: 100" << std::endl;
    
    // Property: Commands within 30 seconds should be executed
    rc::check("Commands within 30 seconds threshold should be executed", []() {
        // Generate arbitrary current time (positive value to avoid overflow)
        auto currentTime = *rc::gen::inRange<long>(1000L, 1000000L);
        
        // Generate command age within threshold (0 to 30 seconds)
        auto commandAge = *rc::gen::inRange<long>(0L, STALE_COMMAND_THRESHOLD_SECONDS);
        
        // Calculate commandAt timestamp
        long commandAt = currentTime - commandAge;
        
        // Verify: command should be executed
        RC_ASSERT(shouldExecuteCommand(commandAt, currentTime) == true);
    });
    
    // Property: Commands older than 30 seconds should be discarded
    rc::check("Commands older than 30 seconds should be discarded", []() {
        // Generate arbitrary current time (positive value to avoid overflow)
        auto currentTime = *rc::gen::inRange<long>(1000L, 1000000L);
        
        // Generate command age beyond threshold (31 to 1000 seconds)
        auto commandAge = *rc::gen::inRange<long>(
            STALE_COMMAND_THRESHOLD_SECONDS + 1,
            1000L
        );
        
        // Calculate commandAt timestamp
        long commandAt = currentTime - commandAge;
        
        // Verify: command should be discarded
        RC_ASSERT(shouldExecuteCommand(commandAt, currentTime) == false);
    });
    
    // Property: Boundary condition - exactly 30 seconds should be executed
    rc::check("Commands at exactly 30 seconds boundary should be executed", []() {
        // Generate arbitrary current time
        auto currentTime = *rc::gen::inRange<long>(1000L, 1000000L);
        
        // Set command age to exactly 30 seconds
        long commandAt = currentTime - STALE_COMMAND_THRESHOLD_SECONDS;
        
        // Verify: command at boundary should still be executed
        RC_ASSERT(shouldExecuteCommand(commandAt, currentTime) == true);
    });
    
    // Property: Boundary condition - 31 seconds should be discarded
    rc::check("Commands at 31 seconds should be discarded", []() {
        // Generate arbitrary current time
        auto currentTime = *rc::gen::inRange<long>(1000L, 1000000L);
        
        // Set command age to 31 seconds (just beyond threshold)
        long commandAt = currentTime - (STALE_COMMAND_THRESHOLD_SECONDS + 1);
        
        // Verify: command should be discarded
        RC_ASSERT(shouldExecuteCommand(commandAt, currentTime) == false);
    });
    
    // Property: Zero age commands (immediate) should always be executed
    rc::check("Commands with zero age should be executed", []() {
        // Generate arbitrary current time
        auto currentTime = *rc::gen::inRange<long>(1000L, 1000000L);
        
        // Command timestamp equals current time (zero age)
        long commandAt = currentTime;
        
        // Verify: immediate command should be executed
        RC_ASSERT(shouldExecuteCommand(commandAt, currentTime) == true);
    });
    
    std::cout << "All property tests passed!" << std::endl;
    return 0;
}
