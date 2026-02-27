type DateParts = {
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
};

function splitDate(now: Date = new Date()): DateParts {
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const millisecond = now.getTime();

    return {
        day,
        hour,
        minute,
        second: Math.floor(millisecond / 1e3),
        millisecond,
    };
}

function toUpperHex(value: number): string {
    return Math.ceil(value).toString(16).toUpperCase();
}

function leftPad(value: string, length: number): string {
    if (value.length >= length) return value;
    return '0'.repeat(length - value.length) + value;
}

function randomHex(length: number): string {
    let result = '';
    for (let index = 0; index < length; index++) {
        result += toUpperHex(Math.random() * 16);
    }
    return leftPad(result, length);
}

export function b_lsid(): string {
    const { millisecond } = splitDate();
    const msHex = toUpperHex(millisecond);
    return `${randomHex(8)}_${msHex}`;
}
