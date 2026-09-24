import { describe, expect, it, vi } from "vitest";

import { createPresentationDeadline } from "../src/presentation-deadline.js";

describe("presentation deadline", () => {
  it("pauses foreground presentation time while hidden", () => {
    vi.useFakeTimers();
    try {
      const deadline = createPresentationDeadline();
      const completed = vi.fn();

      deadline.schedule(6000, completed);
      vi.advanceTimersByTime(2000);
      deadline.pause();
      vi.advanceTimersByTime(10_000);

      expect(completed).not.toHaveBeenCalled();

      deadline.resume();
      vi.advanceTimersByTime(3999);
      expect(completed).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(completed).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not replay a completed transition after pause and resume", () => {
    vi.useFakeTimers();
    try {
      const deadline = createPresentationDeadline();
      const completed = vi.fn();

      deadline.schedule(100, completed);
      vi.advanceTimersByTime(100);
      deadline.pause();
      deadline.resume();
      vi.advanceTimersByTime(1000);

      expect(completed).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces an older pending transition deterministically", () => {
    vi.useFakeTimers();
    try {
      const deadline = createPresentationDeadline();
      const first = vi.fn();
      const second = vi.fn();

      deadline.schedule(1000, first);
      vi.advanceTimersByTime(250);
      deadline.schedule(500, second);
      vi.advanceTimersByTime(500);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancel makes future callbacks inert", () => {
    vi.useFakeTimers();
    try {
      const deadline = createPresentationDeadline();
      const completed = vi.fn();

      deadline.schedule(1000, completed);
      vi.advanceTimersByTime(400);
      deadline.cancel();
      vi.advanceTimersByTime(5000);

      expect(completed).not.toHaveBeenCalled();
      expect(deadline.pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
