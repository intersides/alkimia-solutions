export function setIntervalImmediate(fn, delay, ...args) {
    fn(...args); // run immediately
    return setInterval(fn, delay, ...args); // then repeat
}
