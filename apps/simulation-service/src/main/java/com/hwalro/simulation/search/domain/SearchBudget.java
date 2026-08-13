package com.hwalro.simulation.search.domain;

public record SearchBudget(String preset, int maxTrials, int maxRounds, double trialCapSeconds) {}
