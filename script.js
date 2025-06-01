// script.js (전체 코드 - 2025-06-03 모든 기능 포함 최종 버전)

// 중요!! 본인의 Apps Script 웹 앱 URL로 반드시 교체하세요.
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwQqLERmT9GvvIQC6xIbbXkgiE_OJfNEFZLNbilhrBpwwvZfh56AEXajVyiSfqWBR_m6w/exec'; // <<--- 여기를 꼭 수정해주세요!!!

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM 완전히 로드됨. 스크립트 초기화 시작.");

  // DOM 요소 가져오기
  const calendarEl = document.getElementById('calendar');
  const currentMonthYearEl = document.getElementById('currentMonthYear');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const loaderEl = document.getElementById('loader');
  const statusMessageEl = document.getElementById('statusMessage');

  // 근무 입력 모달 관련 요소
  const modal = document.getElementById('workRecordModal');
  const closeModalBtn = document.getElementById('closeModalBtn'); // 근무 입력 모달 닫기 버튼
  const workRecordForm = document.getElementById('workRecordForm');
  const recordDateEl = document.getElementById('recordDate');
  const staffNameEl = document.getElementById('staffName'); 
  const workTypeEl = document.getElementById('workType'); 
  const timeFieldsEl = document.getElementById('timeFields');
  const startHourEl = document.getElementById('startHour');
  const startMinuteEl = document.getElementById('startMinute');
  const endHourEl = document.getElementById('endHour');
  const endMinuteEl = document.getElementById('endMinute');
  const notesEl = document.getElementById('notes');
  const modalTitle = document.getElementById('modalTitle');
  const repeatOnWeekdayCheckbox = document.getElementById('repeatOnWeekday');
  const repeatContainer = document.getElementById('repeatContainer'); // index.html에 <div id="repeatContainer">...</div> 또는 <div class="checkbox-label">의 부모로 사용될 수 있음
  const saveRecordBtn = document.getElementById('saveRecordBtn');
  const leavePeriodFieldsEl = document.getElementById('leavePeriodFields');
  const leaveStartDateEl = document.getElementById('leaveStartDate');
  const leaveEndDateEl = document.getElementById('leaveEndDate');

  // 직원 명단 및 강조 기능 관련 요소
  const staffListUlEl = document.getElementById('staffListUl');
  let highlightedStaffName = null;

  // 통계 모달 관련 DOM 요소
  const statsButton = document.getElementById('statsButton');
  const statsModal = document.getElementById('statsModal');
  const closeStatsModalBtnElem = document.getElementById('closeStatsModalBtn'); // ID가 중복되지 않도록 index.html에서 "closeStatsModalBtn"으로 수정했다고 가정
  const statsStaffSelect = document.getElementById('statsStaffSelect'); 
  const statsTableContainer = document.getElementById('statsTableContainer');
  const statsSummaryContainer = document.getElementById('statsSummaryContainer');
  const statsMonthYearLabel = document.getElementById('statsMonthYearLabel');

  // 일일 근무 요약 모달 관련 DOM 요소
  const dailySummaryModal = document.getElementById('dailySummaryModal');
  const closeDailySummaryModalBtnElem = document.getElementById('closeDailySummaryModalBtn'); // ID가 중복되지 않도록 index.html에서 "closeDailySummaryModalBtn"으로 수정했다고 가정
  const dailySummaryDateDisplayEl = document.getElementById('dailySummaryDateDisplay');
  const toggleHolidayBtn = document.getElementById('toggleHolidayBtn');
  const dailySummaryWorkListEl = document.getElementById('dailySummaryWorkList');
  const addWorkFromSummaryBtn = document.getElementById('addWorkFromSummaryBtn');

  // 전역 변수
  let staffListCache = []; 
  let currentDisplayedDate = new Date();
  let allRecordsForCurrentMonth = []; 
  let currentMonthHolidays = []; 
  let currentEditingRecordOriginalKey = null; 

  const TIMELINE_START_HOUR = 9;
  const TIMELINE_END_HOUR = 22;
  const TOTAL_TIMELINE_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  const MAX_STAFF_PER_DAY_DISPLAY = 5; 
  const TRACK_HEIGHT_WITH_GAP = 20; 
  const MIN_HOURS_FOR_BAR_DISPLAY = 9;
  const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

  function showLoader() { if(loaderEl) loaderEl.style.display = 'block'; console.log("[Util] 로더 표시"); }
  function hideLoader() { if(loaderEl) loaderEl.style.display = 'none'; console.log("[Util] 로더 숨김"); }

  function showStatusMessage(message, isSuccess = true) { 
    if (!statusMessageEl) return;
    statusMessageEl.textContent = message;
    statusMessageEl.className = 'status-message ' + (isSuccess ? 'success' : 'error');
    statusMessageEl.style.display = 'block';
    setTimeout(() => { statusMessageEl.style.display = 'none'; }, 3000);
  }

  function populateHourOptions(selectElement) { 
    if (!selectElement) { console.warn("populateHourOptions: selectElement 없음", selectElement); return; }
    selectElement.innerHTML = '';
    for (let i = 0; i < 24; i++) { const option = document.createElement('option'); option.value = String(i).padStart(2, '0'); option.textContent = String(i).padStart(2, '0'); selectElement.appendChild(option); }
  }

  function populateMinuteOptions(selectElement) { 
    if (!selectElement) { console.warn("populateMinuteOptions: selectElement 없음", selectElement); return; }
    selectElement.innerHTML = '';
    const minutes = [0, 10, 20, 30, 40, 50];
    minutes.forEach(m => { const option = document.createElement('option'); option.value = String(m).padStart(2, '0'); option.textContent = String(m).padStart(2, '0'); selectElement.appendChild(option); });
  }
  
  function getContrastYIQ(hexcolor){ 
    if (!hexcolor || typeof hexcolor !== 'string' || hexcolor.length < 6) return '#000000'; hexcolor = hexcolor.replace("#", ""); if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(char => char + char).join(''); if (hexcolor.length !== 6) return '#000000'; const r = parseInt(hexcolor.substr(0,2),16); const g = parseInt(hexcolor.substr(2,2),16); const b = parseInt(hexcolor.substr(4,2),16); const yiq = ((r*299)+(g*587)+(b*114))/1000; return (yiq >= 128) ? '#000000' : '#FFFFFF';
  }
    
  async function fetchStaffNames() { 
    showLoader(); 
    try { 
      console.log("[fetchStaffNames] 직원 정보 가져오기 시작..."); 
      const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getStaffInfo`); 
      console.log("[fetchStaffNames] 응답 상태:", response.status, response.ok); 
      if (!response.ok) throw new Error(`[${response.status}] ${response.statusText} - 서버에서 직원 정보를 가져오지 못했습니다.`); 
      const result = await response.json(); 
      console.log("[fetchStaffNames] 파싱된 JSON:", result); 
      if (!result.success) throw new Error(result.error || 'API로부터 직원 정보 로딩 실패.'); 
      staffListCache = result.data || []; 
      populateStaffList(); 
      if (staffNameEl) { 
        staffNameEl.innerHTML = '<option value="">선택하세요</option>'; 
        staffListCache.forEach(s => { 
          const option = document.createElement('option'); option.value = s.name; option.textContent = s.name; staffNameEl.appendChild(option); 
        }); 
      } 
      if (statsStaffSelect) {
        statsStaffSelect.innerHTML = '<option value="">직원을 선택해주세요</option>';
        staffListCache.forEach(staff => {
          const option = document.createElement('option');
          option.value = staff.name;
          option.textContent = staff.name;
          statsStaffSelect.appendChild(option);
        });
      }
    } catch (error) { 
      console.error('Error fetching staff names:', error.message, error.stack); 
      showStatusMessage('직원 목록 로딩 실패: ' + error.message, false); 
      staffListCache = []; 
    } finally { 
      console.log("[fetchStaffNames] 직원 정보 가져오기 과정 종료."); 
    }
  }
  
  function populateStaffList() { 
    if (!staffListUlEl) return; staffListUlEl.innerHTML = ''; if (!staffListCache || staffListCache.length === 0) return;
    staffListCache.forEach(staff => { const li = document.createElement('li'); li.textContent = staff.name; li.style.backgroundColor = staff.color || '#A0A0A0'; li.style.color = getContrastYIQ(staff.color || '#A0A0A0'); li.dataset.staffName = staff.name; li.addEventListener('click', handleStaffListClick); staffListUlEl.appendChild(li); });
  }

  function handleStaffListClick(event) { 
    const clickedStaffName = event.target.dataset.staffName; 
    const currentActiveLi = staffListUlEl.querySelector('.active-highlight'); if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');
    if (highlightedStaffName === clickedStaffName) highlightedStaffName = null; else { highlightedStaffName = clickedStaffName; event.target.classList.add('active-highlight');}
    applyCalendarHighlight();
  }

  function applyCalendarHighlight() { 
    if (!calendarEl) return; const allEntries = calendarEl.querySelectorAll('.work-entry');
    allEntries.forEach(entryEl => { const entryTitle = entryEl.title || ""; const entryStaffNameMatch = entryTitle.match(/^([^|]+)\|/); const entryStaffName = entryStaffNameMatch ? entryStaffNameMatch[1].trim() : null; if (highlightedStaffName) { if (entryStaffName && entryStaffName === highlightedStaffName) { entryEl.classList.add('highlighted'); entryEl.classList.remove('dimmed'); } else { entryEl.classList.add('dimmed'); entryEl.classList.remove('highlighted'); } } else { entryEl.classList.remove('highlighted'); entryEl.classList.remove('dimmed'); } });
  }

  function getHolidayStorageKey(year, month_1_based) { return `holidays_${year}-${String(month_1_based).padStart(2, '0')}`; }

  function loadHolidaysForMonth(year, month_1_based) {
    const key = getHolidayStorageKey(year, month_1_based);
    try { const stored = localStorage.getItem(key); currentMonthHolidays = stored ? JSON.parse(stored) : []; } 
    catch (e) { console.error("localStorage 휴일 로드 오류:", e); currentMonthHolidays = []; }
    console.log(`[loadHolidays] ${year}-${month_1_based} 휴일 로드:`, currentMonthHolidays);
  }

  function saveHolidaysForMonth(year, month_1_based) {
    const key = getHolidayStorageKey(year, month_1_based);
    try { localStorage.setItem(key, JSON.stringify(currentMonthHolidays)); } 
    catch (e) { console.error("localStorage 휴일 저장 오류:", e); showStatusMessage("휴일 정보 저장 실패.", false); }
    console.log(`[saveHolidays] ${year}-${month_1_based} 휴일 저장:`, currentMonthHolidays);
  }
  
  function toggleHoliday(dateStr, dayNumberElementOnCalendar) { 
    console.log(`[toggleHoliday] 호출됨: ${dateStr}`);
    const year = parseInt(dateStr.substring(0, 4)); const month_1_based = parseInt(dateStr.substring(5, 7));
    const holidayIndex = currentMonthHolidays.indexOf(dateStr); const dateObj = new Date(dateStr + "T00:00:00"); const isSunday = dateObj.getDay() === 0;
    if (holidayIndex > -1) { currentMonthHolidays.splice(holidayIndex, 1); if(dayNumberElementOnCalendar) dayNumberElementOnCalendar.classList.remove('holiday-date-number'); if (isSunday && dayNumberElementOnCalendar) dayNumberElementOnCalendar.classList.add('sunday-date-number'); } 
    else { currentMonthHolidays.push(dateStr); if(dayNumberElementOnCalendar) dayNumberElementOnCalendar.classList.add('holiday-date-number'); if (isSunday && dayNumberElementOnCalendar) dayNumberElementOnCalendar.classList.remove('sunday-date-number'); }
    saveHolidaysForMonth(year, month_1_based); 
    if (dailySummaryModal && dailySummaryModal.style.display === 'block' && dailySummaryDateDisplayEl && dailySummaryDateDisplayEl.dataset.currentDate === dateStr) {
        updateHolidayButtonInPopup(dateStr);
    }
  }

  async function renderCalendar(year, month_1_based) { 
    console.log(`[renderCalendar] 시작: ${year}년 ${month_1_based}월`); 
    showLoader(); 
    if (!calendarEl || !currentMonthYearEl) { console.error("Calendar elements not found!"); hideLoader(); return; } 
    calendarEl.innerHTML = ''; currentMonthYearEl.textContent = `${year}년 ${month_1_based}월`; 
    loadHolidaysForMonth(year, month_1_based); 
    WEEKDAYS_KO.forEach((day, index) => { const dayHeader = document.createElement('div'); dayHeader.classList.add('calendar-header'); dayHeader.textContent = day; if (index === 0) dayHeader.classList.add('sunday'); if (index === 6) dayHeader.classList.add('saturday'); calendarEl.appendChild(dayHeader); }); 
    const firstDayOfMonth = new Date(year, month_1_based - 1, 1); const lastDayOfMonth = new Date(year, month_1_based, 0); const daysInMonth = lastDayOfMonth.getDate(); const startDayOfWeek = firstDayOfMonth.getDay(); 
    for (let i = 0; i < startDayOfWeek; i++) { const emptyCell = document.createElement('div'); emptyCell.classList.add('calendar-day', 'other-month'); calendarEl.appendChild(emptyCell); } 
    for (let day = 1; day <= daysInMonth; day++) { 
      const dayCell = document.createElement('div'); dayCell.classList.add('calendar-day'); 
      const currentDateObj = new Date(year, month_1_based - 1, day); 
      const dateStr = `${year}-${String(month_1_based).padStart(2, '0')}-${String(day).padStart(2, '0')}`; 
      const dayNumberEl = document.createElement('span'); dayNumberEl.classList.add('day-number'); dayNumberEl.textContent = day; 
      if (currentMonthHolidays.includes(dateStr)) dayNumberEl.classList.add('holiday-date-number');
      dayNumberEl.addEventListener('click', (event) => { event.stopPropagation(); openDailySummaryPopup(dateStr, dayNumberEl); }); 
      dayCell.appendChild(dayNumberEl); 
      const dayOfWeekVal = currentDateObj.getDay(); 
      if (!dayNumberEl.classList.contains('holiday-date-number')) { if (dayOfWeekVal === 0) dayNumberEl.classList.add('sunday-date-number'); } 
      if (dayOfWeekVal === 6) { if (!dayNumberEl.classList.contains('holiday-date-number')) dayCell.classList.add('saturday'); } 
      const today = new Date(); 
      if (year === today.getFullYear() && (month_1_based - 1) === today.getMonth() && day === today.getDate()) { dayCell.classList.add('today'); if (!dayNumberEl.classList.contains('holiday-date-number')) dayNumberEl.classList.add('today-number'); } 
      const entriesContainer = document.createElement('div'); entriesContainer.classList.add('work-entries-container'); dayCell.appendChild(entriesContainer); 
      dayCell.dataset.date = dateStr; 
      dayCell.addEventListener('click', (event) => { 
        console.log("[renderCalendar] Day cell clicked. Target:", event.target);
        if (event.target === dayCell || event.target === entriesContainer ) {
            console.log("[renderCalendar] Opening modal for new record on date:", dateStr);
            openModalForDate(dateStr); 
        }
      }); 
      calendarEl.appendChild(dayCell); 
    } 
    console.log(`[renderCalendar] 달력 구조 생성 완료. 근무 기록 가져오기 시도: ${year}-${month_1_based}`);
    try { 
      const fetchUrl = `${APPS_SCRIPT_WEB_APP_URL}?action=getWorkRecords&year=${year}&month=${month_1_based}`;
      console.log('[renderCalendar] Fetch URL:', fetchUrl);
      const response = await fetch(fetchUrl); 
      console.log('[renderCalendar] Fetch 응답 상태:', response.status, response.ok); 
      if (!response.ok) { const errorText = await response.text(); console.error('[renderCalendar] Fetch 실패. 상태:', response.status, '응답 내용:', errorText); throw new Error(`[${response.status}] ${response.statusText}. 서버 상세: ${errorText}`); } 
      const result = await response.json(); 
      console.log('[renderCalendar] 파싱된 JSON 결과 (구조):', {success: result.success, dataLength: result.data ? result.data.length : 'N/A', error: result.error, details: result.details, debug_info_length: result.debug_info ? result.debug_info.length : 'N/A' }); 
      if (result.debug_info && result.debug_info.length > 0) { 
          console.warn("[renderCalendar] 서버 DEBUG INFO:"); 
          result.debug_info.forEach(d => { console.warn(`  Row ${d.row_num_in_sheet || d.row}: Raw='${d.colA_raw_value || d.rawDateCell}', Type=${d.colA_type || d.type}, IsDateObj=${d.colA_is_instanceof_date || d.isDateObjViaInstanceof}, ParsedStatus=${d.colA_parsed_status || d.parsed}, finalDate='${d.colA_final_yyyyMMdd || d.finalDateForClient}', Name='${d.colB_name_raw_value || d.raw_B_name}', WorkType='${d.colC_workType_raw_value || d.raw_C_type}'`); });
      } 
      if (!result.success) { console.error('[renderCalendar] API 응답 success:false. 오류:', result.error, '상세:', result.details); throw new Error(result.error || 'API로부터 근무 기록 로딩 실패.'); } 
      allRecordsForCurrentMonth = result.data || []; 
      console.log(`[renderCalendar] 이번 달 기록 (${allRecordsForCurrentMonth.length}개) 처리 시작.`); 
      displayWorkRecords(allRecordsForCurrentMonth); 
      applyCalendarHighlight(); 
      console.log('[renderCalendar] 달력 표시 및 하이라이트 적용 완료.'); 
    } catch (error) { 
      console.error('[renderCalendar] CATCH 블록. 근무 기록 가져오기/처리 중 오류:', error.message, error.stack); 
      allRecordsForCurrentMonth = []; 
      showStatusMessage('근무 기록 로딩 실패: ' + error.message, false); 
    } finally { 
      console.log('[renderCalendar] Fetch 과정 또는 오류 처리 종료, 로더 숨김.'); 
      hideLoader(); 
    }
  }
  
  function displayWorkRecords(records) {
    if (!Array.isArray(records)) { console.warn("[displayWorkRecords] records는 배열이 아님.", records); return; }
    const recordsByDate = {};
    records.forEach(record => { if (record && typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date.substring(0,10))) { const validDateStr = record.date.substring(0,10); (recordsByDate[validDateStr] = recordsByDate[validDateStr] || []).push(record); } else { console.warn("[displayWorkRecords] 유효하지 않은 날짜 형식 기록 건너뜀:", record); } });
    if (calendarEl) { const allEntriesContainers = calendarEl.querySelectorAll('.work-entries-container'); allEntriesContainers.forEach(container => container.innerHTML = ''); }
    Object.keys(recordsByDate).forEach(dateStr => {
      const dayRecords = recordsByDate[dateStr];
      const dayCellContentContainer = calendarEl ? calendarEl.querySelector(`.calendar-day[data-date="${dateStr}"] .work-entries-container`) : null;
      if (!dayCellContentContainer) { console.warn(`[displayWorkRecords] 날짜 ${dateStr}에 대한 컨테이너 못찾음`); return; }
      const staffToTrackMap = new Map(); let nextAvailableTrack = 0;
      dayRecords.sort((a,b) => { if (a.workType === "휴가" || a.workType === "휴무") { if (b.workType !== "휴가" && b.workType !== "휴무") return 1;} else if (b.workType === "휴가" || b.workType === "휴무") return -1; const startTimeCompare = (a.startTime || "99:99").localeCompare(b.startTime || "99:99"); if (startTimeCompare !== 0) return startTimeCompare; return (a.name || "").localeCompare(b.name || ""); });
      dayRecords.forEach(record => {
        if (nextAvailableTrack >= MAX_STAFF_PER_DAY_DISPLAY && !staffToTrackMap.has(record.name)) return;
        const staffMember = staffListCache.find(s => s.name === record.name); const staffColor = staffMember ? (staffMember.color || '#A0A0A0') : '#A0A0A0';
        const entryEl = document.createElement('div'); entryEl.classList.add('work-entry'); entryEl.style.backgroundColor = staffColor;
        const recordIdentifier = { date: record.date, name: record.name, workType: record.workType, startTime: record.startTime || "" };
        entryEl.dataset.recordIdentifier = JSON.stringify(recordIdentifier); entryEl.dataset.recordData = JSON.stringify(record);
        entryEl.title = `${record.name} | ${record.workType}` + (record.startTime && record.workType !== "휴가" && record.workType !== "휴무" ? ` | ${record.startTime}-${record.endTime}` : '') + (record.notes ? ` | 비고: ${record.notes}` : '');
        entryEl.addEventListener('click', (event) => { 
            console.log("[displayWorkRecords] work-entry 클릭됨. Target:", event.target);
            if (event.target.classList.contains('delete-btn')) return; 
            event.stopPropagation(); openModalForEdit(entryEl); 
        });
        const deleteBtn = document.createElement('span'); deleteBtn.classList.add('delete-btn'); deleteBtn.innerHTML = '&times;'; deleteBtn.title = '이 기록 삭제';
        deleteBtn.addEventListener('click', (event) => { event.stopPropagation(); const identifierString = entryEl.dataset.recordIdentifier; if (confirm("정말로 이 근무 기록을 삭제하시겠습니까?")) handleDeleteRecord(identifierString); });
        let currentTrack;
        if (staffToTrackMap.has(record.name)) currentTrack = staffToTrackMap.get(record.name); else if (nextAvailableTrack < MAX_STAFF_PER_DAY_DISPLAY) { currentTrack = nextAvailableTrack; staffToTrackMap.set(record.name, currentTrack); nextAvailableTrack++; } else return;
        entryEl.style.top = `${currentTrack * TRACK_HEIGHT_WITH_GAP}px`;
        let textContentForBar = "";
        if (record.workType === "휴가" || record.workType === "휴무") { entryEl.classList.add('vacation'); textContentForBar = `${record.name}: ${record.workType}`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); }
        else if (!record.startTime || !record.endTime || TOTAL_TIMELINE_MINUTES <= 0 || !/^\d{2}:\d{2}$/.test(record.startTime) || !/^\d{2}:\d{2}$/.test(record.endTime) ) { textContentForBar = `${record.name}: ${record.workType || '(시간없음)'}`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); entryEl.style.position = 'relative'; entryEl.style.width = '100%'; }
        else { 
          const timeToMinutes = (timeStr) => { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };
          const actualRecordStartMinutes = timeToMinutes(record.startTime); const actualRecordEndMinutes = timeToMinutes(record.endTime);
          const timelineStartTotalMinutes = TIMELINE_START_HOUR * 60;
          let actualStartOffsetMinutes = actualRecordStartMinutes - timelineStartTotalMinutes;
          let actualDurationMinutes = actualRecordEndMinutes - actualRecordStartMinutes;
          if (actualDurationMinutes < 0 && actualRecordStartMinutes > actualRecordEndMinutes) { actualDurationMinutes = (24*60 - actualRecordStartMinutes) + actualRecordEndMinutes; } 
          if (actualDurationMinutes < 0) actualDurationMinutes = 0;
          let displayActualStartOffsetMinutes = Math.max(0, actualStartOffsetMinutes);
          let displayActualEndOffsetMinutes = Math.min(TOTAL_TIMELINE_MINUTES, actualStartOffsetMinutes + actualDurationMinutes);
          let displayActualDurationMinutes = Math.max(0, displayActualEndOffsetMinutes - displayActualStartOffsetMinutes);
          if (displayActualDurationMinutes <= 0 && actualDurationMinutes > 0) { 
             textContentForBar = `${record.startTime}-${record.endTime}`; 
             entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn);
             entryEl.style.position = 'relative'; entryEl.style.width = '100%'; entryEl.title += ` (타임라인 범위 벗어남)`; 
          } else if (displayActualDurationMinutes > 0) {
            const minVisualDurationMinutes = MIN_HOURS_FOR_BAR_DISPLAY * 60;
            let visualDurationMinutes = Math.max(displayActualDurationMinutes, minVisualDurationMinutes);
            let visualStartOffsetMinutes = displayActualEndOffsetMinutes - visualDurationMinutes; 
            visualStartOffsetMinutes = Math.max(0, visualStartOffsetMinutes); 
            let visualEndOffsetMinutes = Math.min(TOTAL_TIMELINE_MINUTES, visualStartOffsetMinutes + visualDurationMinutes);
            const finalDisplayDurationMinutes = visualEndOffsetMinutes - visualStartOffsetMinutes;
            const finalDisplayStartOffsetMinutes = visualStartOffsetMinutes;
            if (finalDisplayDurationMinutes <= 0) { textContentForBar = `${record.startTime}-${record.endTime}`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); entryEl.style.position = 'relative'; entryEl.style.width = '100%'; } 
            else {
                const leftPercentage = (finalDisplayStartOffsetMinutes / TOTAL_TIMELINE_MINUTES) * 100;
                const widthPercentage = (finalDisplayDurationMinutes / TOTAL_TIMELINE_MINUTES) * 100;
                entryEl.style.left = `${Math.max(0, Math.min(100, leftPercentage))}%`; entryEl.style.width = `${Math.max(0, Math.min(100 - leftPercentage, widthPercentage))}%`;
                const barWidthPx = (dayCellContentContainer.clientWidth || 100) * (widthPercentage / 100);
                if (barWidthPx < 20) textContentForBar = '&nbsp;'; else if (barWidthPx < 70) textContentForBar = `${record.startTime.substring(0,2)}-${record.endTime.substring(0,2)}`; else textContentForBar = `${record.startTime}-${record.endTime}`; 
                if (textContentForBar === '&nbsp;') entryEl.innerHTML = textContentForBar; else entryEl.textContent = textContentForBar;
                entryEl.appendChild(deleteBtn);
            }
          } else { textContentForBar = `${record.name}: ${record.workType}`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); entryEl.style.position = 'relative'; entryEl.style.width = '100%'; }
        }
        dayCellContentContainer.appendChild(entryEl);
      });
    });
  }

  async function handleDeleteRecord(identifierString) { 
    console.log("[handleDeleteRecord] 호출됨. Identifier:", identifierString);
    if (!identifierString) { showStatusMessage("삭제할 기록 정보가 없습니다.", false); return; } showLoader();
    try { const keyObject = JSON.parse(identifierString); const payload = { action: 'deleteWorkRecord', key: keyObject }; const response = await fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); if (!response.ok) { const errorText = await response.text(); throw new Error(`서버 오류 ${response.status}: ${errorText}`);} const result = await response.json(); if (result.success) { showStatusMessage(result.message || "기록 삭제됨.", true); renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); } else { throw new Error(result.error || "삭제 실패."); } } catch (error) { console.error('Error deleting record:', error); showStatusMessage('삭제 중 오류: ' + error.message, false); } finally { hideLoader(); }
  }

  // script.js (openModalForDate 함수 수정)

function openModalForDate(dateStr, existingRecordDataWithIdentifier = null) { 
  console.log("[openModalForDate] 호출됨. Date:", dateStr, "ExistingRecord:", existingRecordDataWithIdentifier);

  // 각 DOM 요소 확인 및 로깅
  const elementsToVerify = {
    workRecordForm, recordDateEl, modalTitle, repeatOnWeekdayCheckbox, saveRecordBtn, 
    staffNameEl, workTypeEl, startHourEl, startMinuteEl, endHourEl, endMinuteEl, 
    notesEl, leavePeriodFieldsEl, leaveStartDateEl, leaveEndDateEl, timeFieldsEl, 
    repeatContainer, modal // modal 자체도 확인
  };

  let missingElement = null;
  for (const key in elementsToVerify) {
    if (!elementsToVerify[key]) {
      missingElement = key;
      break;
    }
  }

  if (missingElement) {
    console.error(`openModalForDate: 필수 모달 요소 중 "${missingElement}"을(를) 찾을 수 없습니다 (값이 null 또는 undefined). HTML ID를 확인해주세요.`);
    // 어떤 요소가 문제인지 사용자에게도 간단히 알릴 수 있습니다 (선택 사항).
    // showStatusMessage(`오류: ${missingElement} 요소를 찾을 수 없습니다.`, false);
    return; 
  }
  // 모든 요소가 정상이면 이후 로직 실행
  console.log("[openModalForDate] 모든 필수 DOM 요소 확인 완료.");

  // --- 이하 기존 openModalForDate 함수 로직 ---
  workRecordForm.reset(); 
  repeatOnWeekdayCheckbox.checked = false; 
  if(notesEl) notesEl.value = ""; 
  
  const repeatLabelElement = document.querySelector('label[for="repeatOnWeekday"]');

  if (existingRecordDataWithIdentifier) { 
    const existingRecord = existingRecordDataWithIdentifier; 
    // ... (수정 모드 로직 - 이전 최종본과 동일하게 유지) ...
    modalTitle.textContent = `${existingRecord.date} 근무 기록 수정`; recordDateEl.value = existingRecord.date; 
    staffNameEl.value = existingRecord.name; workTypeEl.value = existingRecord.workType;
    if (existingRecord.workType === '휴무') {
      leaveStartDateEl.value = existingRecord.date; leaveEndDateEl.value = existingRecord.date;  
    } else if (existingRecord.workType !== '휴가') { 
      if (existingRecord.startTime && /^\d{2}:\d{2}$/.test(existingRecord.startTime)) { const [startH, startM] = existingRecord.startTime.split(':'); startHourEl.value = startH; startMinuteEl.value = startM; } else { startHourEl.value = "00"; startMinuteEl.value = "00";}
      if (existingRecord.endTime && /^\d{2}:\d{2}$/.test(existingRecord.endTime)) { const [endH, endM] = existingRecord.endTime.split(':'); endHourEl.value = endH; endMinuteEl.value = endM; } else { endHourEl.value = "00"; endMinuteEl.value = "00";}
    } else { startHourEl.value = "00"; startMinuteEl.value = "00"; endHourEl.value = "00"; endMinuteEl.value = "00"; }
    notesEl.value = existingRecord.notes || ""; workRecordForm.dataset.mode = "edit"; 
    try { currentEditingRecordOriginalKey = JSON.parse(existingRecord.identifier); } catch(e) { currentEditingRecordOriginalKey = null; }
    saveRecordBtn.textContent = "수정";
    // if (repeatLabelElement) repeatLabelElement.style.display = 'none'; // toggleTimeFields에서 처리
    // if(repeatOnWeekdayCheckbox) repeatOnWeekdayCheckbox.style.display = 'none';
  } else { 
    modalTitle.textContent = `${dateStr} 근무 기록 추가`; recordDateEl.value = dateStr;
    if(staffNameEl) staffNameEl.value = ""; if(workTypeEl) workTypeEl.value = "주간"; 
    if(startHourEl) startHourEl.value = "09"; if(startMinuteEl) startMinuteEl.value = "00";
    if(endHourEl) endHourEl.value = "18"; if(endMinuteEl) endMinuteEl.value = "00";
    if(leaveStartDateEl) leaveStartDateEl.value = dateStr; 
    if(leaveEndDateEl) leaveEndDateEl.value = dateStr;  
    workRecordForm.dataset.mode = "add"; currentEditingRecordOriginalKey = null; saveRecordBtn.textContent = "저장";
    // if (repeatLabelElement) repeatLabelElement.style.display = (workTypeEl && workTypeEl.value === '휴가' ? 'none' : 'flex'); // toggleTimeFields에서 처리
    // if (repeatOnWeekdayCheckbox) repeatOnWeekdayCheckbox.style.display = (workTypeEl && workTypeEl.value === '휴가' ? 'none' : 'inline-block');
  }
  toggleTimeFields(); 
  if(modal) modal.style.display = 'block';
}
  function openModalForEdit(entryElement) { 
      console.log("[openModalForEdit] 호출됨. EntryElement:", entryElement);
      const recordDataString = entryElement.dataset.recordData; const recordIdentifierString = entryElement.dataset.recordIdentifier;
      if (recordDataString && recordIdentifierString) { const recordToEdit = JSON.parse(recordDataString); recordToEdit.identifier = recordIdentifierString; openModalForDate(recordToEdit.date, recordToEdit); } 
      else { console.error("수정할 레코드 정보를 찾을 수 없습니다.", entryElement.dataset); showStatusMessage("레코드 정보를 불러오지 못했습니다.", false); }
  }

  if(closeModalBtn) closeModalBtn.onclick = () => { if(modal) modal.style.display = 'none'; };
  if(closeDailySummaryModalBtnElem) closeDailySummaryModalBtnElem.onclick = () => { if(dailySummaryModal) dailySummaryModal.style.display = 'none'; };
  if(closeStatsModalBtnElem) closeStatsModalBtnElem.onclick = () => { if(statsModal) statsModal.style.display = 'none'; }; 

  window.onclick = (event) => { 
    if (event.target == modal && modal) modal.style.display = 'none';
    if (event.target == statsModal && statsModal) statsModal.style.display = 'none';
    if (event.target == dailySummaryModal && dailySummaryModal) dailySummaryModal.style.display = 'none';
  };
  if(workTypeEl) workTypeEl.addEventListener('change', toggleTimeFields); 
  
  function toggleTimeFields() { 
    if (!workTypeEl || !timeFieldsEl || !leavePeriodFieldsEl || !repeatContainer || !startHourEl || !startMinuteEl || !endHourEl || !endMinuteEl || !repeatOnWeekdayCheckbox) { console.warn("toggleTimeFields: 일부 DOM 요소 찾을 수 없음"); return;}
    const selectedType = workTypeEl.value; const currentMode = workRecordForm.dataset.mode;
    const isEditMode = currentMode === 'edit';

    if (selectedType === '휴무') {
      timeFieldsEl.style.display = 'none'; leavePeriodFieldsEl.style.display = 'block'; repeatContainer.style.display = 'none'; repeatOnWeekdayCheckbox.checked = false;
    } else if (selectedType === '휴가') {
      timeFieldsEl.style.display = 'none'; leavePeriodFieldsEl.style.display = 'none';
      if (isEditMode) { repeatContainer.style.display = 'none'; repeatOnWeekdayCheckbox.checked = false; } 
      else { repeatContainer.style.display = 'block'; } // `block` 또는 `flex` (CSS에 따라)
    } else { // 주간, 마감
      timeFieldsEl.style.display = 'block'; leavePeriodFieldsEl.style.display = 'none';
      if (isEditMode) { repeatContainer.style.display = 'none'; repeatOnWeekdayCheckbox.checked = false; } 
      else { repeatContainer.style.display = 'block'; }
    }
    const disableTimeInputs = selectedType === '휴가' || selectedType === '휴무';
    startHourEl.disabled = disableTimeInputs; startMinuteEl.disabled = disableTimeInputs; endHourEl.disabled = disableTimeInputs; endMinuteEl.disabled = disableTimeInputs;
    repeatOnWeekdayCheckbox.disabled = (selectedType === '휴무' || selectedType === '휴가' || isEditMode);
    if (repeatOnWeekdayCheckbox.disabled) repeatOnWeekdayCheckbox.checked = false;
  }

  if(workRecordForm) workRecordForm.addEventListener('submit', async (e) => { 
    e.preventDefault(); showLoader(); const formMode = workRecordForm.dataset.mode || "add"; 
    let recordsToSave = []; let actionType = ""; let payload = {};
    const commonData = { name: staffNameEl.value, notes: notesEl.value.trim() };
    if (!commonData.name) { showStatusMessage('이름을 선택해주세요.', false); hideLoader(); return; }

    if (formMode === "edit") {
        actionType = "updateWorkRecord";
        const currentRecordData = { date: recordDateEl.value, ...commonData, workType: workTypeEl.value, 
            startTime: (workTypeEl.value === '휴가' || workTypeEl.value === '휴무') ? '' : `${startHourEl.value}:${startMinuteEl.value}`, 
            endTime: (workTypeEl.value === '휴가' || workTypeEl.value === '휴무') ? '' : `${endHourEl.value}:${endMinuteEl.value}` };
        payload = { action: actionType, originalKey: currentEditingRecordOriginalKey, newData: currentRecordData }; 
    } else { 
        actionType = "saveWorkRecords";
        const workTypeValue = workTypeEl.value;
        if (workTypeValue === '휴무') {
            const startDateStr = leaveStartDateEl.value; const endDateStr = leaveEndDateEl.value;
            if (!startDateStr || !endDateStr) { showStatusMessage('휴무 시작일과 종료일을 모두 선택해주세요.', false); hideLoader(); return; }
            const startDate = new Date(startDateStr + "T00:00:00"); const endDate = new Date(endDateStr + "T00:00:00");
            if (startDate > endDate) { showStatusMessage('휴무 종료일은 시작일보다 이전일 수 없습니다.', false); hideLoader(); return; }
            let currentDateIter = new Date(startDate);
            while(currentDateIter <= endDate) {
                recordsToSave.push({ ...commonData, date: `${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth() + 1).padStart(2, '0')}-${String(currentDateIter.getDate()).padStart(2, '0')}`, workType: '휴무', startTime: '', endTime: '' });
                currentDateIter.setDate(currentDateIter.getDate() + 1);
            }
        } else { 
            const shouldRepeat = repeatOnWeekdayCheckbox.checked;
            const singleRecordData = { date: recordDateEl.value, ...commonData, workType: workTypeValue, 
                startTime: workTypeValue === '휴가' ? '' : `${startHourEl.value}:${startMinuteEl.value}`, 
                endTime: workTypeValue === '휴가' ? '' : `${endHourEl.value}:${endMinuteEl.value}` };
            recordsToSave.push(singleRecordData); 
            if (shouldRepeat && workTypeValue !== '휴가' && workTypeValue !== '휴무') { 
                const originalDateObj = new Date(singleRecordData.date + "T00:00:00");
                const originalDayOfMonth = originalDateObj.getDate(); const targetDayOfWeek = originalDateObj.getDay();
                const yearVal = currentDisplayedDate.getFullYear(); const monthVal = currentDisplayedDate.getMonth(); 
                const daysInMonthVal = new Date(yearVal, monthVal + 1, 0).getDate();
                for (let dayVal = originalDayOfMonth + 1; dayVal <= daysInMonthVal; dayVal++) { 
                    const currentDateInLoop = new Date(yearVal, monthVal, dayVal);
                    if (currentDateInLoop.getDay() === targetDayOfWeek) {
                        recordsToSave.push({ ...singleRecordData, date: `${yearVal}-${String(monthVal + 1).padStart(2, '0')}-${String(dayVal).padStart(2, '0')}` });
                    }
                }
            }
        }
        payload = { action: actionType, records: recordsToSave }; 
    }
    console.log(`[FormSubmit] ${formMode} 요청 보낼 데이터:`, payload);
    try { const response = await fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(payload) }); if (!response.ok) { const errorText = await response.text(); throw new Error(`서버 오류 ${response.status}: ${errorText}`); } const result = await response.json(); if (result.success) { showStatusMessage(result.message || "성공!", true); if(modal) modal.style.display = 'none'; renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); } else { throw new Error(result.error || "작업 실패."); } } catch (error) { console.error(`Error ${formMode} record(s):`, error); showStatusMessage(`${formMode === "edit" ? "수정" : "저장"} 중 오류: ` + error.message, false); }
    finally { hideLoader(); if(repeatOnWeekdayCheckbox) repeatOnWeekdayCheckbox.checked = false; }
  });

  // --- 일일 근무 요약 팝업 관련 ---
  if(addWorkFromSummaryBtn) addWorkFromSummaryBtn.onclick = () => { if (dailySummaryDateDisplayEl && dailySummaryDateDisplayEl.dataset.currentDate) { openModalForDate(dailySummaryDateDisplayEl.dataset.currentDate); if(dailySummaryModal) dailySummaryModal.style.display = 'none'; }};
  if(toggleHolidayBtn) toggleHolidayBtn.onclick = () => { if (dailySummaryDateDisplayEl && dailySummaryDateDisplayEl.dataset.currentDate) { const dateStr = dailySummaryDateDisplayEl.dataset.currentDate; const dayNumberElOnCalendar = calendarEl.querySelector(`.calendar-day[data-date="${dateStr}"] .day-number`); toggleHoliday(dateStr, dayNumberElOnCalendar); updateHolidayButtonInPopup(dateStr); }};
  function updateHolidayButtonInPopup(dateStr) { if (!toggleHolidayBtn) return; if (currentMonthHolidays.includes(dateStr)) { toggleHolidayBtn.textContent = "✓ 휴일 지정됨"; toggleHolidayBtn.classList.add('is-holiday'); } else { toggleHolidayBtn.textContent = "이 날을 휴일로 지정"; toggleHolidayBtn.classList.remove('is-holiday'); }}
  function openDailySummaryPopup(dateStr, dayNumberElOnCalendarArgument) { 
    if (!dailySummaryModal || !dailySummaryDateDisplayEl || !dailySummaryWorkListEl || !toggleHolidayBtn) return;
    const dateObjForDisplay = new Date(dateStr + "T00:00:00");
    dailySummaryDateDisplayEl.textContent = `${dateStr} (${WEEKDAYS_KO[dateObjForDisplay.getDay()]}) 근무 요약`;
    dailySummaryDateDisplayEl.dataset.currentDate = dateStr; 
    updateHolidayButtonInPopup(dateStr); 
    const recordsForDay = allRecordsForCurrentMonth.filter(r => r.date === dateStr);
    dailySummaryWorkListEl.innerHTML = ''; 
    if (recordsForDay.length === 0) { dailySummaryWorkListEl.innerHTML = '<p>해당 날짜의 근무 기록이 없습니다.</p>'; } 
    else { const ul = document.createElement('ul'); recordsForDay.sort((a,b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99")); recordsForDay.forEach(r => { const li = document.createElement('li'); const colorDot = document.createElement('span'); colorDot.classList.add('staff-color-dot'); const staffInfo = staffListCache.find(s => s.name === r.name); colorDot.style.backgroundColor = staffInfo ? (staffInfo.color || '#A0A0A0') : '#A0A0A0'; const nameSpan = document.createElement('span'); nameSpan.classList.add('staff-name'); nameSpan.textContent = r.name; const typeSpan = document.createElement('span'); typeSpan.classList.add('work-type'); typeSpan.textContent = r.workType; const timeSpan = document.createElement('span'); timeSpan.classList.add('work-time'); if (r.workType === "휴가" || r.workType === "휴무") timeSpan.textContent = ""; else timeSpan.textContent = `${r.startTime || ''} - ${r.endTime || ''}`; li.appendChild(colorDot); li.appendChild(nameSpan); li.appendChild(typeSpan); li.appendChild(timeSpan); ul.appendChild(li); }); dailySummaryWorkListEl.appendChild(ul); }
    if (dailySummaryModal) dailySummaryModal.style.display = 'block';
  }

  // --- 통계 모달 로직 ---
  if(statsButton) statsButton.addEventListener('click', openStatsModal);
  if(closeStatsModalBtnElem) closeStatsModalBtnElem.onclick = () => { if(statsModal) statsModal.style.display = 'none'; };
  if(statsStaffSelect) statsStaffSelect.addEventListener('change', displayStaffStats);
  async function openStatsModal() { 
    if (staffListCache.length === 0) await fetchStaffNames(); 
    if(!statsStaffSelect || !statsMonthYearLabel || !statsModal) return;
    // 직원 선택 드롭다운은 fetchStaffNames에서 이미 채워짐
    await displayStaffStats(); // 초기 "직원 선택" 프롬프트 표시
    if(statsModal) statsModal.style.display = 'block';
  }
  async function displayStaffStats() { 
    if(!statsTableContainer || !statsSummaryContainer || !statsStaffSelect) return;
    const selectedStaff = statsStaffSelect.value; const year = currentDisplayedDate.getFullYear(); const month = currentDisplayedDate.getMonth() + 1;
    if(statsMonthYearLabel) statsMonthYearLabel.textContent = `${year}년 ${month}월 통계`;
    if (selectedStaff === "") { statsTableContainer.innerHTML = `<p class="stats-placeholder-message">확인하고 싶은 직원 이름을 선택해주세요. ☝️</p>`; statsSummaryContainer.innerHTML = ""; return; }
    let needsServerFetchForStats = true;
    if (allRecordsForCurrentMonth.length > 0 && allRecordsForCurrentMonth[0]) { if (allRecordsForCurrentMonth[0].date && typeof allRecordsForCurrentMonth[0].date === 'string') { try { const firstRecordDateParts = allRecordsForCurrentMonth[0].date.substring(0,10).split('-'); const firstRecordYear = parseInt(firstRecordDateParts[0]); const firstRecordMonth = parseInt(firstRecordDateParts[1]); if (firstRecordYear === year && firstRecordMonth === month) needsServerFetchForStats = false; } catch (e) { console.warn("통계용 캐시 확인 중 날짜 파싱 오류", e); }}}
    if (needsServerFetchForStats) {
        console.log("[displayStaffStats] 통계용 데이터 새로 가져오기..."); showLoader();
        try { const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getWorkRecords&year=${year}&month=${month}`); if (!response.ok) throw new Error(`[${response.status}] ${response.statusText}`); const result = await response.json(); if (!result.success) throw new Error(result.error || 'Failed to load work records for stats.'); allRecordsForCurrentMonth = result.data || []; console.log("[displayStaffStats] 통계용 데이터 로드 완료:", allRecordsForCurrentMonth.length, "개"); }
        catch (error) { showStatusMessage("통계용 데이터 로드 실패: " + error.message, false); allRecordsForCurrentMonth = []; } finally { hideLoader(); }
    } else { console.log("[displayStaffStats] 캐시된 월간 데이터 사용:", allRecordsForCurrentMonth.length, "개"); }
    let filteredRecords = allRecordsForCurrentMonth.filter(r => r.name === selectedStaff);
    if (filteredRecords.length === 0) { statsTableContainer.innerHTML = `<p class="stats-placeholder-message">${selectedStaff} 님의 ${year}년 ${month}월 근무 기록이 없습니다.</p>`; statsSummaryContainer.innerHTML = ""; return; }
    filteredRecords.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let tableHTML = `<table><thead><tr><th>날짜</th><th>요일</th><th>근무형태</th><th>출근</th><th>퇴근</th><th>근무시간(H)</th><th>비고</th></tr></thead><tbody>`;
    const workTypeSummary = { '주간': 0, '마감': 0, '휴무': 0 }; let totalMonthHours = 0; 
    filteredRecords.forEach(r => { let dayOfWeek = '-'; if (r.date && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.date)) { try { const dateObj = new Date(r.date + "T00:00:00"); if(!isNaN(dateObj.getTime())) dayOfWeek = WEEKDAYS_KO[dateObj.getDay()]; } catch(e) { console.warn("요일 계산 중 날짜 파싱 오류(통계):", r.date, e); }} const hours = parseFloat(r.totalHours) || 0; tableHTML += `<tr><td>${r.date ? r.date.substring(5) : '?'}</td><td class="${dayOfWeek === '토' ? 'saturday-text' : ''} ${dayOfWeek === '일' ? 'sunday-text' : ''}">${dayOfWeek}</td><td>${r.workType||'-'}</td><td>${r.startTime||'-'}</td><td>${r.endTime||'-'}</td><td>${hours > 0 ? hours.toFixed(1) : (r.workType === '휴가' || r.workType === '휴무' ? r.workType : '-')}</td><td title="${r.notes||''}" class="notes-cell">${r.notes||''}</td></tr>`; if (workTypeSummary.hasOwnProperty(r.workType)) workTypeSummary[r.workType] += hours; if (r.workType !== '휴가' && r.workType !== '휴무') totalMonthHours += hours; });
    tableHTML += `</tbody></table>`; statsTableContainer.innerHTML = tableHTML;
    let summaryHTML = `<h4>📝 ${selectedStaff}님 근무 형태별 합계:</h4>`; 
    summaryHTML += `<div>- 주간: ${workTypeSummary['주간'].toFixed(1)} 시간</div>`; 
    summaryHTML += `<div>- 마감: ${workTypeSummary['마감'].toFixed(1)} 시간</div>`;
    const 휴무일수 = filteredRecords.filter(r => r.workType === '휴무').length; 
    if (휴무일수 > 0) { summaryHTML += `<div>- 휴무: ${휴무일수} 일</div>`; }
    summaryHTML += `<div class="total-hours-summary">💵 총 근무시간 (휴가/휴무 제외): ${totalMonthHours.toFixed(1)} 시간</div>`; 
    statsSummaryContainer.innerHTML = summaryHTML;
  }

  // --- 이전/다음 달 버튼 ---
  if(prevMonthBtn) prevMonthBtn.addEventListener('click', () => { 
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() - 1); 
    highlightedStaffName = null; 
    if(staffListUlEl){ const currentActiveLi = staffListUlEl.querySelector('.active-highlight'); if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');}
    const year = currentDisplayedDate.getFullYear(); const month = currentDisplayedDate.getMonth() + 1;
    renderCalendar(year, month); // renderCalendar 시작 시 loadHolidaysForMonth 호출됨
  });
  if(nextMonthBtn) nextMonthBtn.addEventListener('click', () => { 
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() + 1); 
    highlightedStaffName = null;
    if(staffListUlEl){ const currentActiveLi = staffListUlEl.querySelector('.active-highlight'); if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');}
    const year = currentDisplayedDate.getFullYear(); const month = currentDisplayedDate.getMonth() + 1;
    renderCalendar(year, month); // renderCalendar 시작 시 loadHolidaysForMonth 호출됨
  });
  
  // --- 앱 초기화 ---
  async function initializeApp() {
    console.log("앱 초기화 시작...");
    await new Promise(resolve => setTimeout(resolve, 0)); // DOM 요소가 확실히 준비될 시간을 줌
    
    populateHourOptions(startHourEl); 
    populateMinuteOptions(startMinuteEl); 
    populateHourOptions(endHourEl); 
    populateMinuteOptions(endMinuteEl);

    await fetchStaffNames(); 
    await renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); 
    console.log("앱 초기화 완료.");
  }

  initializeApp();
});