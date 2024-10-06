// JavaScript code for PDF Annotator
const fileInput = document.getElementById('file-input');
const pdfCanvas = document.getElementById('pdf-canvas');
const annotationCanvas = document.getElementById('annotation-canvas');
const pdfCtx = pdfCanvas.getContext('2d');
const annotationCtx = annotationCanvas.getContext('2d');

let pdfDoc = null;           // For pdf.js
let pdfDocLib = null;        // For pdf-lib
let originalPdfBytes = null; // Original PDF bytes
let pageNum = 1;
let scale = 1.5;

let annotationData = [];     // Store annotations per page

// Handle file input change
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    const fileReader = new FileReader();
    fileReader.onload = async function() {
        originalPdfBytes = new Uint8Array(this.result);

        // Load PDF with pdf.js
        const loadingTask = pdfjsLib.getDocument({ data: originalPdfBytes });
        loadingTask.promise.then(function(pdf) {
            pdfDoc = pdf;
            document.getElementById('page-count').textContent = pdfDoc.numPages;
            pageNum = 1;
            annotationData = new Array(pdfDoc.numPages + 1); // Pages are 1-indexed
            renderPage(pageNum);
        }, function(reason) {
            console.error(reason);
            alert('Error loading PDF.');
        });

        // Load PDF with pdf-lib
        pdfDocLib = await PDFLib.PDFDocument.load(originalPdfBytes);
    };
    fileReader.readAsArrayBuffer(file);
});

// Render a page
function renderPage(num) {
    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        annotationCanvas.height = viewport.height;
        annotationCanvas.width = viewport.width;

        const renderContext = {
            canvasContext: pdfCtx,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);
        renderTask.promise.then(function() {
            // Load existing annotations
            if (annotationData[num]) {
                const img = new Image();
                img.src = annotationData[num];
                img.onload = function() {
                    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
                    annotationCtx.drawImage(img, 0, 0);
                };
            } else {
                annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
            }

            document.getElementById('page-num').textContent = num;
        });
    });
}

// Save current annotations
function saveCurrentAnnotations() {
    annotationData[pageNum] = annotationCanvas.toDataURL();
}

// Page navigation
document.getElementById('prev-page').addEventListener('click', function() {
    if (pageNum <= 1) return;
    saveCurrentAnnotations();
    pageNum--;
    renderPage(pageNum);
});

document.getElementById('next-page').addEventListener('click', function() {
    if (pageNum >= pdfDoc.numPages) return;
    saveCurrentAnnotations();
    pageNum++;
    renderPage(pageNum);
});

// Drawing on the annotation canvas
let isDrawing = false;
let lastX = 0;
let lastY = 0;

annotationCanvas.addEventListener('mousedown', startDrawing);
annotationCanvas.addEventListener('mousemove', draw);
annotationCanvas.addEventListener('mouseup', stopDrawing);
annotationCanvas.addEventListener('mouseout', stopDrawing);

// Touch support
annotationCanvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    annotationCanvas.dispatchEvent(mouseEvent);
});
annotationCanvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    annotationCanvas.dispatchEvent(mouseEvent);
});
annotationCanvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    annotationCanvas.dispatchEvent(mouseEvent);
});

// Drawing functions
function startDrawing(e) {
    isDrawing = true;
    const [x, y] = getMousePos(annotationCanvas, e);
    lastX = x;
    lastY = y;
}

function draw(e) {
    if (!isDrawing) return;
    const [x, y] = getMousePos(annotationCanvas, e);
    annotationCtx.strokeStyle = 'red';
    annotationCtx.lineWidth = 2;
    annotationCtx.lineCap = 'round';

    annotationCtx.beginPath();
    annotationCtx.moveTo(lastX, lastY);
    annotationCtx.lineTo(x, y);
    annotationCtx.stroke();

    lastX = x;
    lastY = y;
}

function stopDrawing() {
    isDrawing = false;
}

// Get mouse position
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return [
        (evt.clientX - rect.left) * (canvas.width / rect.width),
        (evt.clientY - rect.top) * (canvas.height / rect.height)
    ];
}

// Save the edited PDF
document.getElementById('save-pdf').addEventListener('click', async function() {
    saveCurrentAnnotations();

    for (let i = 1; i <= pdfDocLib.getPageCount(); i++) {
        const page = pdfDocLib.getPage(i - 1);
        if (annotationData[i]) {
            const pngDataUrl = annotationData[i];
            const pngImageBytes = await fetch(pngDataUrl).then(res => res.arrayBuffer());
            const pngImage = await pdfDocLib.embedPng(pngImageBytes);

            const { width, height } = page.getSize();
            page.drawImage(pngImage, {
                x: 0,
                y: 0,
                width: width,
                height: height,
                opacity: 0.5,
            });
        }
    }

    const pdfBytes = await pdfDocLib.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Create a link to download the file
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotated.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
