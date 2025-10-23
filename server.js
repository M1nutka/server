// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(cors({
    origin: ['https://server-production-a448.up.railway.app/', 'https://vk.com'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname));

// Кэш для данных
let cache = {
    dates: null,
    lastUpdate: null,
    schedules: {}
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function parseDateForSorting(dateString) {
    const months = {
        'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
        'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
        'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
    };

    const firstNumberMatch = dateString.match(/(\d+)/);
    if (!firstNumberMatch) return 99999999;
    
    const firstNumber = parseInt(firstNumberMatch[1]);
    
    let month = '01';
    for (const [monthName, monthCode] of Object.entries(months)) {
        if (dateString.includes(monthName)) {
            month = monthCode;
            break;
        }
    }
    
    const year = new Date().getFullYear();
    const day = firstNumber.toString().padStart(2, '0');
    return parseInt(`${year}${month}${day}`);
}

function normalizeUrlDate(urlDate) {
    return decodeURIComponent(urlDate);
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

async function fetchDates() {
    try {
        console.log('📅 Получаем список дат с сайта...');
        const response = await axios.get('https://www.pilot-ipek.ru/raspo/', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const datesMap = new Map();

        $('.date-button').each((i, elem) => {
            const dateText = $(elem).find('.day-number').text().trim();
            const href = $(elem).attr('href');
            
            if (dateText && href && !dateText.includes('звонков')) {
                const urlDate = normalizeUrlDate(href.replace('/raspo/', ''));
                const sortKey = parseDateForSorting(dateText);
                
                if (!datesMap.has(dateText)) {
                    datesMap.set(dateText, {
                        displayDate: dateText,
                        url: 'https://www.pilot-ipek.ru' + href,
                        urlDate: urlDate,
                        sortKey: sortKey
                    });
                }
            }
        });

        const dates = Array.from(datesMap.values());
        dates.sort((a, b) => a.sortKey - b.sortKey);

        //console.log(`✅ Найдено ${dates.length} дат`);
        return dates;
    } catch (error) {
        console.error('❌ Ошибка получения дат:', error.message);
        return [];
    }
}

async function parseDaySchedule(dateUrl, dateName) {
    try {
        console.log(`📖 Парсим расписание: ${dateName}`);
        const response = await axios.get(dateUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const scheduleData = [];
        
        const isRangeDate = dateName.includes(',');
        let currentDayIndex = 0;

        // Сначала собираем ВСЕ группы из ВСЕХ таблиц в правильном порядке
        const allGroupsInOrder = [];
        $('.table-wrapper table').each((tableIndex, table) => {
            const rows = $(table).find('tr');
            const headerRow = $(rows[0]);
            
            headerRow.find('td').each((i, cell) => {
                if (i > 0) {
                    const groupName = $(cell).find('h1').text().trim();
                    if (groupName && !allGroupsInOrder.includes(groupName)) {
                        allGroupsInOrder.push(groupName);
                        console.log(`🔍 Группа из таблицы ${tableIndex + 1}: ${groupName}`);
                    }
                }
            });
        });

        console.log(`📊 Все группы в правильном порядке для ${dateName}:`, allGroupsInOrder);

        // Затем парсим расписание как обычно
        $('.table-wrapper table').each((tableIndex, table) => {
            const rows = $(table).find('tr');
            
            // Получаем заголовок с группами из первой строки
            const headerRow = $(rows[0]);
            const groups = [];
            
            headerRow.find('td').each((i, cell) => {
                if (i > 0) {
                    const groupName = $(cell).find('h1').text().trim();
                    if (groupName) {
                        groups.push(groupName);
                    }
                }
            });

            console.log(`📊 Таблица ${tableIndex + 1}: группы: ${groups.join(', ')}`);

            // Обрабатываем ВСЕ строки таблицы (включая первую)
            rows.each((rowIndex, row) => {
                const cells = $(row).find('td');
                
                // Пропускаем строку если это заголовок с группами
                if (rowIndex === 0) {
                    // Но проверяем, нет ли часа общения в заголовочной строке
                    cells.slice(1).each((cellIndex, cell) => {
                        if (cellIndex < groups.length) {
                            const groupName = groups[cellIndex];
                            const cellText = $(cell).text().trim();
                            
                            // Проверяем, есть ли в ячейке час общения
                            if (cellText.includes('Час общения') || cellText.includes('Разговоры о важном')) {
                                console.log(`🎯 Найден час общения в заголовке для группы ${groupName}: ${cellText}`);
                                
                                scheduleData.push({
                                    group: groupName,
                                    time: '8.30 – 9.00', // Время по умолчанию для часа общения перед первой парой
                                    pair: '',
                                    subject: 'Час общения',
                                    details: '',
                                    teacher: '',
                                    room: '',
                                    allDetails: [],
                                    date: dateName,
                                    isRange: isRangeDate,
                                    isCommunicationHour: true,
                                    tableIndex: tableIndex,
                                    dayIndex: currentDayIndex
                                });
                            }
                        }
                    });
                    return; // Пропускаем обработку заголовочной строки как обычной пары
                }

                // Обработка обычных строк с парами
                const firstCell = $(cells[0]);
                const pairText = firstCell.find('p').first().text().trim();
                const timeText = firstCell.find('p').last().text().trim();
                
                const pairMatch = pairText.match(/(\d+) пара/);
                const timeMatch = timeText.match(/(\d+\.\d+)\s*–\s*(\d+\.\d+)/);

                // Обрабатываем ячейки даже если нет номера пары (для часа общения)
                const time = timeMatch ? `${timeMatch[1]} – ${timeMatch[2]}` : '8.30 – 9.00';
                const pairNumber = pairMatch ? pairMatch[1] : '';

                // Обрабатываем ячейки с занятиями для каждой группы
                cells.slice(1).each((cellIndex, cell) => {
                    if (cellIndex < groups.length) {
                        const groupName = groups[cellIndex];
                        const cellText = $(cell).text().trim();
                        const paragraphs = $(cell).find('p');
                        
                        // Пропускаем пустые ячейки
                        if (!cellText) return;

                        let subject = '';
                        let details = [];

                        // Первый параграф - всегда предмет
                        if (paragraphs.eq(0).text().trim()) {
                            subject = paragraphs.eq(0).text().trim();
                        }

                        // Все остальные параграфы - детали
                        for (let i = 1; i < paragraphs.length; i++) {
                            const detail = paragraphs.eq(i).text().trim();
                            if (detail) {
                                details.push(detail);
                            }
                        }

                        // Очищаем данные
                        subject = subject.replace(/\s+/g, ' ').trim();

                        // ОПРЕДЕЛЯЕМ ЧАС ОБЩЕНИЯ - проверяем ВСЕ варианты
                        const isCommunicationHour = 
                            cellText.includes('Час общения') || 
                            cellText.includes('Разговоры о важном') ||
                            subject.includes('Час общения') ||
                            subject.includes('Разговоры о важном') ||
                            details.some(detail => 
                                detail.includes('Час общения') || 
                                detail.includes('Разговоры о важном')
                            );

                        // Для часа общения меняем предмет и обрабатываем детали
                        const finalSubject = isCommunicationHour ? 'Час общения' : subject;
                        const finalDetails = isCommunicationHour ? 
                            details.filter(detail => 
                                !detail.includes('Час общения') && 
                                !detail.includes('Разговоры о важном')
                            ) : 
                            details;

                        const detailsText = finalDetails.join(' • ');

                        // Добавляем в расписание если есть subject или это час общения
                        if (subject || isCommunicationHour) {
                            scheduleData.push({
                                group: groupName,
                                time: time,
                                pair: isCommunicationHour ? '' : pairNumber,
                                subject: finalSubject,
                                details: detailsText,
                                teacher: finalDetails.length > 0 ? finalDetails[0] : '',
                                room: finalDetails.length > 1 ? finalDetails[finalDetails.length - 1] : '',
                                allDetails: finalDetails,
                                date: dateName,
                                isRange: isRangeDate,
                                isCommunicationHour: isCommunicationHour,
                                tableIndex: tableIndex,
                                dayIndex: currentDayIndex
                            });

                            console.log(`✅ Группа ${groupName}: ${isCommunicationHour ? 'Час общения' : (pairNumber ? pairNumber + ' пара' : '')} - ${finalSubject} | ${finalDetails.join(' | ')}`);
                        }
                    }
                });
            });
            
            if (isRangeDate) {
                currentDayIndex++;
            }
        });

        console.log(`✅ Расписание ${dateName}: ${scheduleData.length} пар из ${currentDayIndex} таблиц`);
        
        // Сохраняем правильный порядок групп в кэше для API /groups
        if (allGroupsInOrder.length > 0) {
            // Сохраняем в глобальной переменной для доступа из API /groups
            if (!global.groupOrder) global.groupOrder = [];
            allGroupsInOrder.forEach(group => {
                if (!global.groupOrder.includes(group)) {
                    global.groupOrder.push(group);
                }
            });
            console.log(`💾 Обновлен глобальный порядок групп:`, global.groupOrder);
        }
        
        return scheduleData;
    } catch (error) {
        console.error(`❌ Ошибка парсинга ${dateName}:`, error.message);
        return [];
    }
}

async function parseBellsSchedule() {
    try {
        console.log('🔔 Парсим расписание звонков с сайта...');
        const response = await axios.get('https://www.pilot-ipek.ru/raspo/%D0%A0%D0%B0%D1%81%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20%D0%B7%D0%B2%D0%BE%D0%BD%D0%BA%D0%BE%D0%B2', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const bellsData = {
            weekday: [],
            saturday: []
        };

        let currentSection = '';
        let isSaturday = false;

        // Парсим основной контент
        $('body p, body .table-wrapper').each((i, elem) => {
            const $elem = $(elem);
            const text = $elem.text().trim();

            // Определяем секцию
            if (text.includes('ПОНЕДЕЛЬНИК-ПЯТНИЦА')) {
                currentSection = 'weekday';
                isSaturday = false;
                return;
            } else if (text.includes('СУББОТА')) {
                currentSection = 'saturday';
                isSaturday = true;
                return;
            }

            // Обрабатываем таблицы
            if ($elem.hasClass('table-wrapper')) {
                $elem.find('table tr').each((j, row) => {
                    const $row = $(row);
                    const cells = $row.find('td');
                    
                    if (cells.length === 1) {
                        // Это перемена
                        const breakText = $row.text().trim();
                        if (breakText.includes('перемена')) {
                            const bellsItem = {
                                pair: 'break',
                                time: breakText,
                                description: 'перемена',
                                type: 'break'
                            };
                            
                            if (isSaturday) {
                                bellsData.saturday.push(bellsItem);
                            } else {
                                bellsData.weekday.push(bellsItem);
                            }
                        }
                    } else if (cells.length === 2) {
                        // Это пара
                        const pairInfo = $(cells[0]).text().trim();
                        const timeInfo = $(cells[1]).text().trim();
                        
                        const pairMatch = pairInfo.match(/(\d+) пара/);
                        const timeMatch = timeInfo.match(/(\d+\.\d+)\s*–\s*(\d+\.\d+)/);
                        
                        if (pairMatch && timeMatch) {
                            const bellsItem = {
                                pair: pairMatch[1],
                                time: `${timeMatch[1]} – ${timeMatch[2]}`,
                                description: `${pairMatch[1]} пара`,
                                type: 'pair'
                            };
                            
                            if (isSaturday) {
                                bellsData.saturday.push(bellsItem);
                            } else {
                                bellsData.weekday.push(bellsItem);
                            }
                        }
                    }
                });
            }
            
            // Обрабатываем заголовки секций
            else if (text.includes('Первая смена')) {
                bellsData.weekday.push({
                    pair: 'section',
                    time: '',
                    description: 'Первая смена',
                    type: 'section'
                });
            } else if (text.includes('Дополнительная пара')) {
                bellsData.weekday.push({
                    pair: 'section',
                    time: '',
                    description: 'Дополнительная пара',
                    type: 'section'
                });
            } else if (text.includes('Вторая смена')) {
                bellsData.weekday.push({
                    pair: 'section',
                    time: '',
                    description: 'Вторая смена',
                    type: 'section'
                });
            }
        });

        console.log('✅ Расписание звонков успешно распарсено');
        console.log(`📊 Будни: ${bellsData.weekday.length} элементов`);
        console.log(`📊 Суббота: ${bellsData.saturday.length} элементов`);

        return bellsData;
    } catch (error) {
        console.error('❌ Ошибка парсинга расписания звонков:', error.message);
        // Возвращаем расписание по умолчанию в случае ошибки
        return getBellsSchedule();
    }
}

// ==================== ОБНОВЛЕНИЕ КЭША ====================

async function updateCache() {
    try {
        console.log('🔄 Обновляем кэш...');
        const dates = await fetchDates();
        
        if (dates.length > 0) {
            cache.dates = dates;
            cache.lastUpdate = new Date();
            
            // Очищаем старые расписания
            cache.schedules = {};
            
            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];
                console.log(`📖 Парсим: ${date.displayDate}`);
                cache.schedules[date.urlDate] = await parseDaySchedule(date.url, date.displayDate);
            }
            
            console.log('✅ Кэш обновлен');
        }
    } catch (error) {
        console.error('❌ Ошибка обновления кэша:', error);
    }
}

// ==================== СТАТИЧЕСКОЕ РАСПИСАНИЕ ЗВОНКОВ ====================

// function getBellsSchedule() {
//     return {
//         weekday: [
//             { pair: '1', time: '8.30 – 10.00', description: '1 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 10 минут', description: 'перемена', type: 'break' },
//             { pair: '2', time: '10.10 – 11.40', description: '2 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 20 минут', description: 'перемена', type: 'break' },
//             { pair: '3', time: '12.00 – 13.30', description: '3 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 10 минут', description: 'перемена', type: 'break' },
//             { pair: '4', time: '13.40 – 15.10', description: '4 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 20 минут', description: 'перемена', type: 'break' },
//             { pair: '5', time: '15.30 – 17.00', description: '5 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 10 минут', description: 'перемена', type: 'break' },
//             { pair: '6', time: '17.10 – 18.40', description: '6 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 10 минут', description: 'перемена', type: 'break' },
//             { pair: '7', time: '18.50 – 20.20', description: '7 пара', type: 'pair' }
//         ],
//         saturday: [
//             { pair: '1', time: '8.30 – 10.00', description: '1 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 5 минут', description: 'перемена', type: 'break' },
//             { pair: '2', time: '10.05 – 11.35', description: '2 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 20 минут', description: 'перемена', type: 'break' },
//             { pair: '3', time: '11.55 – 13.25', description: '3 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 5 минут', description: 'перемена', type: 'break' },
//             { pair: '4', time: '13.30 – 15.00', description: '4 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 5 минут', description: 'перемена', type: 'break' },
//             { pair: '5', time: '15.05 – 16.35', description: '5 пара', type: 'pair' },
//             { pair: 'break', time: 'перемена 5 минут', description: 'перемена', type: 'break' },
//             { pair: '6', time: '16.40 – 18.10', description: '6 пара', type: 'pair' }
//         ]
//     };
// }

// ==================== API МАРШРУТЫ ====================

app.get('/api/dates', (req, res) => {
    res.json({
        success: true,
        dates: cache.dates || [],
        lastUpdate: cache.lastUpdate
    });
});

app.get('/api/schedule/:date', async (req, res) => {
    try {
        const dateParam = req.params.date;
        let schedule = cache.schedules[dateParam];

        if (!schedule) {
            const dateInfo = cache.dates?.find(d => d.urlDate === dateParam);
            if (dateInfo) {
                schedule = await parseDaySchedule(dateInfo.url, dateInfo.displayDate);
                cache.schedules[dateParam] = schedule;
            }
        }

        res.json({
            success: true,
            date: dateParam,
            schedule: schedule || [],
            count: schedule?.length || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/schedule/group/:group/:date', async (req, res) => {
    try {
        let { group, date } = req.params;
        group = decodeURIComponent(group);
        date = decodeURIComponent(date);
        
        const dateInfo = cache.dates?.find(d => d.urlDate === date);
        if (!dateInfo) {
            return res.status(404).json({
                success: false,
                error: 'Дата не найдена'
            });
        }

        if (!cache.schedules[dateInfo.urlDate]) {
            cache.schedules[dateInfo.urlDate] = await parseDaySchedule(dateInfo.url, dateInfo.displayDate);
        }

        const groupSchedule = cache.schedules[dateInfo.urlDate].filter(item => 
            item.group.toLowerCase().includes(group.toLowerCase())
        );

        res.json({
            success: true,
            group: group,
            date: dateInfo.displayDate,
            dateUrl: dateInfo.urlDate,
            schedule: groupSchedule,
            count: groupSchedule.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/schedule/group/:group/:date/split', async (req, res) => {
    try {
        let { group, date } = req.params;
        group = decodeURIComponent(group);
        date = decodeURIComponent(date);
        
        const dateInfo = cache.dates?.find(d => d.urlDate === date);
        if (!dateInfo) {
            return res.status(404).json({
                success: false,
                error: 'Дата не найдена'
            });
        }

        const isRangeDate = dateInfo.displayDate.includes(',');
        
        if (!isRangeDate) {
            // Обработка одиночной даты
            const schedule = cache.schedules[dateInfo.urlDate] || await parseDaySchedule(dateInfo.url, dateInfo.displayDate);
            const groupSchedule = schedule.filter(item => 
                item.group.toLowerCase().includes(group.toLowerCase())
            );
            
            return res.json({
                success: true,
                group: group,
                date: dateInfo.displayDate,
                dateUrl: dateInfo.urlDate,
                isRange: false,
                schedule: groupSchedule,
                count: groupSchedule.length
            });
        } else {
            // Обработка диапазона дат (пятница-суббота)
            const fullSchedule = cache.schedules[dateInfo.urlDate] || await parseDaySchedule(dateInfo.url, dateInfo.displayDate);
            const groupSchedule = fullSchedule.filter(item => 
                item.group.toLowerCase().includes(group.toLowerCase())
            );
            
            const dateParts = dateInfo.displayDate.split(',').map(part => part.trim());
            const days = [];
            
            // Разделяем по tableIndex - каждая таблица это отдельный день
            const tablesData = {};
            
            groupSchedule.forEach(item => {
                const tableIndex = item.tableIndex || 0;
                if (!tablesData[tableIndex]) {
                    tablesData[tableIndex] = [];
                }
                tablesData[tableIndex].push(item);
            });
            
            // Сортируем таблицы по индексу
            const sortedTableIndices = Object.keys(tablesData).sort((a, b) => parseInt(a) - parseInt(b));
            
            // Создаем дни на основе таблиц
            sortedTableIndices.forEach((tableIndex, index) => {
                if (dateParts[index]) {
                    days.push({
                        day: dateParts[index],
                        schedule: tablesData[tableIndex],
                        isPartOfRange: true
                    });
                }
            });
            
            // Если дней меньше чем частей даты, добавляем оставшиеся
            while (days.length < dateParts.length) {
                days.push({
                    day: dateParts[days.length],
                    schedule: [],
                    isPartOfRange: true
                });
            }
            
            const totalCount = days.reduce((sum, day) => sum + day.schedule.length, 0);
            
            res.json({
                success: true,
                group: group,
                date: dateInfo.displayDate,
                dateUrl: dateInfo.urlDate,
                isRange: true,
                days: days,
                count: totalCount
            });
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
app.get('/api/schedule/group/:group', (req, res) => {
    try {
        const group = req.params.group;
        const { date } = req.query;
        
        let filteredSchedule = [];
        
        if (date && cache.schedules[date]) {
            filteredSchedule = cache.schedules[date].filter(item => 
                item.group.toLowerCase().includes(group.toLowerCase())
            );
        } else {
            Object.values(cache.schedules).forEach(daySchedule => {
                const groupSchedule = daySchedule.filter(item => 
                    item.group.toLowerCase().includes(group.toLowerCase())
                );
                filteredSchedule = filteredSchedule.concat(groupSchedule);
            });
        }

        res.json({
            success: true,
            group: group,
            date: date || 'all',
            schedule: filteredSchedule,
            count: filteredSchedule.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Расписание звонков
app.get('/api/bells', (req, res) => {
    res.json({
        success: true,
        schedule: getBellsSchedule(),
        lastUpdate: new Date()
    });
});

app.get('/api/groups', (req, res) => {
    try {
        let groupOrder = [];
        
        // Пробуем взять порядок из глобальной переменной (собранный при парсинге)
        if (global.groupOrder && global.groupOrder.length > 0) {
            groupOrder = global.groupOrder;
            console.log(`📊 Используем глобальный порядок групп:`, groupOrder);
        } 
        // Если нет глобального порядка, берем из кэша расписаний
        else if (cache.schedules && Object.keys(cache.schedules).length > 0) {
            const firstDateKey = Object.keys(cache.schedules)[0];
            if (firstDateKey && cache.schedules[firstDateKey]) {
                const firstDaySchedule = cache.schedules[firstDateKey];
                const seen = new Set();
                
                firstDaySchedule.forEach(item => {
                    if (item.group && item.group.trim() && !seen.has(item.group)) {
                        seen.add(item.group);
                        groupOrder.push(item.group);
                    }
                });
                console.log(`📊 Используем порядок из первой даты:`, groupOrder);
            }
        }

        console.log(`📊 Итоговый порядок групп:`, groupOrder);
        console.log(`📊 Найдено групп: ${groupOrder.length}`);
        
        res.json({
            success: true,
            groups: groupOrder
        });
    } catch (error) {
        console.error('❌ Ошибка получения групп:', error);
        res.json({
            success: true,
            groups: []
        });
    }
});

// Статические страницы
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/group.html', (req, res) => res.sendFile(__dirname + '/group.html'));
app.get('/bells.html', (req, res) => res.sendFile(__dirname + '/bells.html'));
app.get('/mainGroup.html', (req, res) => res.sendFile(__dirname + '/mainGroup.html'));
app.get('/mainGroup/:group/:date', (req, res) => res.sendFile(__dirname + '/mainGroup.html'));
app.get('/mainGroup/:group/group.html', (req, res) => res.redirect('/group.html'));
app.get('/rasp.html', (req, res) => res.sendFile(__dirname + '/rasp.html'));

app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Сервер работает',
        datesCount: cache.dates?.length || 0
    });
});

// ==================== ЗАПУСК СЕРВЕРА ====================

// ТЕПЕРЬ updateCache определена, можно вызывать
setInterval(updateCache, 30 * 60 * 1000);
updateCache();

app.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 СЕРВЕР ЗАПУЩЕН!');
    console.log(`📍 Локально: http://localhost:${PORT}`);
    console.log(`📍 Локальная сеть: http://10.3.5.112:${PORT}`);
    console.log('=================================');

});
