/**
 * GestureHandler - Native Pointer Events gesture recognition
 *
 * Replaces Hammer.js with native browser APIs for modern browsers.
 * Implements: tap, doubletap, press, panstart, panmove, panend, pinch
 */

// Configuration
const TAP_MAX_DURATION = 250; // ms - max time for a tap
const TAP_MAX_DISTANCE = 10; // px - max movement for a tap
const DOUBLETAP_MAX_INTERVAL = 300; // ms - max time between taps
const PRESS_MIN_DURATION = 251; // ms - min time for press/hold
const PAN_THRESHOLD = 5; // px - min movement to start pan

/**
 * Calculate distance between two points
 */
function getDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate center point of two pointers
 */
function getCenter(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * GestureHandler class
 * Provides Hammer.js-compatible gesture recognition using native Pointer Events
 */
class GestureHandler {
  /**
   * @param {HTMLElement} element - The element to attach gesture handling to
   * @param {object} [options] - Configuration options
   */
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      pinchEnabled: true,
      ...options,
    };

    // Event listeners map: eventType -> Set of callbacks
    this._listeners = new Map();

    // Active pointers tracking
    this._pointers = new Map();

    // Gesture state
    this._state = {
      // Tap detection
      lastTapTime: 0,
      lastTapCenter: null,

      // Press detection
      pressTimer: null,
      pressTriggered: false,

      // Pan detection
      isPanning: false,
      panStarted: false,
      startPointer: null,
      startCenter: null,

      // Pinch detection
      initialPinchDistance: null,
      lastScale: 1,
    };

    // Bound handlers for cleanup
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);

    this._bindEvents();
  }

  /**
   * Bind native pointer events
   */
  _bindEvents() {
    this.element.addEventListener("pointerdown", this._onPointerDown);
    this.element.addEventListener("pointermove", this._onPointerMove);
    this.element.addEventListener("pointerup", this._onPointerUp);
    this.element.addEventListener("pointercancel", this._onPointerCancel);
    // Note: We don't listen to pointerleave because setPointerCapture
    // ensures we get events even when pointer leaves the element

    // Prevent default touch behaviors to avoid conflicts
    this.element.style.touchAction = "none";
  }

  /**
   * Create a normalized event object compatible with Hammer.js events
   */
  _createEvent(type, pointerEvent, extra = {}) {
    const pointers = Array.from(this._pointers.values());
    let center;

    if (pointers.length >= 2) {
      center = getCenter(
        { x: pointers[0].clientX, y: pointers[0].clientY },
        { x: pointers[1].clientX, y: pointers[1].clientY }
      );
    } else if (pointers.length === 1) {
      center = { x: pointers[0].clientX, y: pointers[0].clientY };
    } else if (pointerEvent) {
      center = { x: pointerEvent.clientX, y: pointerEvent.clientY };
    } else {
      center = { x: 0, y: 0 };
    }

    const startCenter = this._state.startCenter || center;

    return {
      type,
      center,
      deltaX: center.x - startCenter.x,
      deltaY: center.y - startCenter.y,
      scale: extra.scale || 1,
      isFirst: extra.isFirst || false,
      isFinal: extra.isFinal || false,
      srcEvent: pointerEvent,
      pointers,
      changedPointers: pointerEvent ? [pointerEvent] : pointers,
      preventDefault: () => pointerEvent?.preventDefault(),
      ...extra,
    };
  }

  /**
   * Handle pointer down event
   */
  _handlePointerDown(event) {
    // Store this pointer
    this._pointers.set(event.pointerId, event);

    // Capture pointer for reliable tracking
    this.element.setPointerCapture(event.pointerId);

    const pointerCount = this._pointers.size;

    if (pointerCount === 1) {
      // Single pointer - potential tap, press, or pan start
      this._state.startPointer = { x: event.clientX, y: event.clientY };
      this._state.startCenter = { x: event.clientX, y: event.clientY };
      this._state.startTime = Date.now();
      this._state.isPanning = false;
      this._state.panStarted = false;
      this._state.pressTriggered = false;

      // Start press timer
      this._state.pressTimer = setTimeout(() => {
        if (!this._state.isPanning && this._pointers.size === 1) {
          this._state.pressTriggered = true;
          this._emit("press", this._createEvent("press", event));
        }
      }, PRESS_MIN_DURATION);

      // Emit input start (hammer.input with isFirst)
      this._emitInput(event, true, false);
    } else if (pointerCount === 2 && this.options.pinchEnabled) {
      // Two pointers - start pinch
      this._cancelPress();
      const pointers = Array.from(this._pointers.values());
      this._state.initialPinchDistance = getDistance(
        { x: pointers[0].clientX, y: pointers[0].clientY },
        { x: pointers[1].clientX, y: pointers[1].clientY }
      );
      this._state.lastScale = 1;
    }
  }

  /**
   * Handle pointer move event
   */
  _handlePointerMove(event) {
    if (!this._pointers.has(event.pointerId)) return;

    // Update pointer position
    this._pointers.set(event.pointerId, event);

    const pointerCount = this._pointers.size;

    if (pointerCount === 1 && this._state.startPointer) {
      // Check for pan
      const distance = getDistance(this._state.startPointer, {
        x: event.clientX,
        y: event.clientY,
      });

      if (distance > PAN_THRESHOLD) {
        this._cancelPress();
        this._state.isPanning = true;

        if (!this._state.panStarted) {
          this._state.panStarted = true;
          this._emit(
            "panstart",
            this._createEvent("panstart", event, { isFirst: true })
          );
        } else {
          this._emit("panmove", this._createEvent("panmove", event));
        }
      }
    } else if (pointerCount === 2 && this.options.pinchEnabled) {
      // Handle pinch
      const pointers = Array.from(this._pointers.values());
      const currentDistance = getDistance(
        { x: pointers[0].clientX, y: pointers[0].clientY },
        { x: pointers[1].clientX, y: pointers[1].clientY }
      );

      if (this._state.initialPinchDistance) {
        const scale = currentDistance / this._state.initialPinchDistance;
        this._emit(
          "pinch",
          this._createEvent("pinch", event, {
            scale,
          })
        );
        this._state.lastScale = scale;
      }
    }
  }

  /**
   * Handle pointer up event
   */
  _handlePointerUp(event) {
    if (!this._pointers.has(event.pointerId)) return;

    const wasMultiTouch = this._pointers.size > 1;

    // Remove this pointer
    this._pointers.delete(event.pointerId);

    try {
      this.element.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore if capture was already released
    }

    this._cancelPress();

    // Emit input end (hammer.input with isFinal)
    if (this._pointers.size === 0) {
      this._emitInput(event, false, true);
    }

    if (wasMultiTouch) {
      // Reset pinch state
      this._state.initialPinchDistance = null;
      return;
    }

    const duration = Date.now() - this._state.startTime;
    const distance = getDistance(this._state.startPointer, {
      x: event.clientX,
      y: event.clientY,
    });

    if (this._state.panStarted) {
      // End pan
       this._emit(
        "panend",
        this._createEvent("panend", event, { isFinal: true })
      );
      this._state.panStarted = false;
      this._state.isPanning = false;
    } else if (
      duration < TAP_MAX_DURATION &&
      distance < TAP_MAX_DISTANCE &&
      !this._state.pressTriggered
    ) {
      // This is a tap
      const now = Date.now();
      const lastTapCenter = this._state.lastTapCenter;
      const tapCenter = { x: event.clientX, y: event.clientY };

      // Check for double tap
      if (
        lastTapCenter &&
        now - this._state.lastTapTime < DOUBLETAP_MAX_INTERVAL &&
        getDistance(lastTapCenter, tapCenter) < TAP_MAX_DISTANCE
      ) {
        this._emit("doubletap", this._createEvent("doubletap", event));
        this._state.lastTapTime = 0;
        this._state.lastTapCenter = null;
      } else {
        // Single tap
        this._emit("tap", this._createEvent("tap", event));
        this._state.lastTapTime = now;
        this._state.lastTapCenter = tapCenter;
      }
    }

    // Reset state
    this._state.startPointer = null;
  }

  /**
   * Handle pointer cancel event
   */
  _handlePointerCancel(event) {
    this._handlePointerUp(event);
  }

  /**
   * Cancel press timer
   */
  _cancelPress() {
    if (this._state.pressTimer) {
      clearTimeout(this._state.pressTimer);
      this._state.pressTimer = null;
    }
  }

  /**
   * Emit hammer.input events (isFirst/isFinal)
   */
  _emitInput(event, isFirst, isFinal) {
    this._emit(
      "hammer.input",
      this._createEvent("hammer.input", event, { isFirst, isFinal })
    );
  }

  /**
   * Emit an event to registered listeners
   */
  _emit(eventType, event) {
    const listeners = this._listeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (err) {
          console.error(`Error in gesture handler for ${eventType}:`, err);
        }
      });
    }
  }

  /**
   * Register an event listener
   * @param {string} eventTypes - Space-separated event types
   * @param {Function} callback - Event handler
   */
  on(eventTypes, callback) {
    eventTypes.split(" ").forEach((eventType) => {
      if (!this._listeners.has(eventType)) {
        this._listeners.set(eventType, new Set());
      }
      this._listeners.get(eventType).add(callback);
    });
    return this;
  }

  /**
   * Unregister an event listener
   * @param {string} eventTypes - Space-separated event types
   * @param {Function} callback - Event handler to remove
   */
  off(eventTypes, callback) {
    eventTypes.split(" ").forEach((eventType) => {
      const listeners = this._listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
      }
    });
    return this;
  }

  /**
   * Get a recognizer (for Hammer.js API compatibility)
   * Returns a mock object with set() method
   */
  get(recognizerName) {
    return {
      set: (options) => {
        if (recognizerName === "pinch" && options.enable !== undefined) {
          this.options.pinchEnabled = options.enable;
        }
        // Pan threshold could be configured here if needed
        return this;
      },
    };
  }

  /**
   * Clean up and remove all event listeners
   */
  destroy() {
    this._cancelPress();

    this.element.removeEventListener("pointerdown", this._onPointerDown);
    this.element.removeEventListener("pointermove", this._onPointerMove);
    this.element.removeEventListener("pointerup", this._onPointerUp);
    this.element.removeEventListener("pointercancel", this._onPointerCancel);

    this._listeners.clear();
    this._pointers.clear();
  }
}

/**
 * Compatibility constant for pan direction (Hammer.DIRECTION_ALL)
 */
GestureHandler.DIRECTION_ALL = 30;

export default GestureHandler;
