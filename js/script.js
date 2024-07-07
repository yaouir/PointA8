

(() => {
    "use strict"

    // Parameters

    let classListIndex = 0; 

    const saveInterval = 60 // Point recovery save in seconds
    const fontBaseSize = 12 // Text size in pixels
    const fontColor = "rgba(0, 31, 63, 1)" // Base font color
    const borderColor = "rgba(0, 31, 63, 0.5)" // Base point border color
    const backgroundColor = "rgba(0, 116, 217, 0.2)" // Base point fill color
    const markedFontColor = "rgba(255, 65, 54, 1)" // Marked point font color
    const markedBorderColor = "rgba(255, 65, 54, 0.5)" // Marked point border color
    const markedBackgroundColor = "rgba(255, 133, 27, 0.2)" // Marked point fill color
    const pointRadius = 5; // Radius of the circle around the point
    const scrollSpeed = 1.1 // Multiplying factor of wheel speed
    const minZoom = 0.1 // Smallest zoom allowed
    const maxZoom = 5 // Largest zoom allowed
    const resetCanvasOnChange = true // Whether to return to default position and zoom on image change
    const defaultScale = 0.5 // Default zoom level for images. Can be overridden with fittedZoom
    const drawGuidelines = true // Whether to draw guidelines for cursor
    const fittedZoom = true // Whether to fit image in the screen by it's largest dimension. Overrides defaultScale

    // Main containers
    let canvas = null
    let images = {}
    let classes = {}
    let bboxes = {}

    const extensions = ["jpg", "jpeg", "png", "JPG", "JPEG", "PNG"]

    let currentImage = null
    let currentClass = null
    let currentPoint = null

    // Scaling containers
    let scale = defaultScale
    let canvasX = 0
    let canvasY = 0
    let screenX = 0
    let screenY = 0

    // Mouse container
    const mouse = {
        x: 0,
        y: 0,
        realX: 0,
        realY: 0,
        buttonL: false,
        buttonR: false,
        startRealX: 0,
        startRealY: 0
    }

    // Prevent context menu on right click - it's used for panning
    document.addEventListener("contextmenu", function (e) {
        e.preventDefault()
    }, false)

    const isSupported = ()  => {
        try {
            const key = "__some_random_key_1234%(*^()^)___"

            localStorage.setItem(key, key)
            localStorage.removeItem(key)

            return true
        } catch (e) {
            return false
        }
    }

    // Save bboxes to local storage every X seconds
    if (isSupported() === true) {
        setInterval(() => {
            if (Object.keys(bboxes).length > 0) {
                localStorage.setItem("bboxes", JSON.stringify(bboxes))
            }
        }, saveInterval * 1000)
    } else {
        alert("Restore function is not supported. If you need it, use Chrome or Firefox instead.")
    }

    // Start everything
    document.onreadystatechange = () => {
        if (document.readyState === "complete") {
            listenCanvas()
            listenCanvasMouse()
            listenImageLoad()
            listenClassInput()
            listenClassSelect()
            listenBboxLoad()
            listenBboxSave()
            listenKeyboard()
        }
    }

    const listenCanvas = () => {
        canvas = new Canvas("canvas", document.getElementById("right").clientWidth, window.innerHeight - 20)

        canvas.on("draw", (context) => {
            if (currentImage !== null) {
                drawImage(context)
                drawNewPoint(context)
                drawExistingPoints(context)
                drawCross(context)
            } else {
                drawIntro(context)
            }
        }).start()
    }

    const drawImage = (context) => {
        context.drawImage(currentImage.object, zoomX(0), zoomY(0), zoom(currentImage.width), zoom(currentImage.height))
    }

    const drawIntro = (context) => {
        setFontStyles(context, false)
        context.fillText("USAGE:", zoomX(20), zoomY(50))
        context.fillText("1. Upload your image (jpg, png).", zoomX(20), zoomY(100))
        context.fillText("2. Add your classes.", zoomX(20), zoomY(150))
        context.fillText("3. Upload or restore, if any, points (json files).", zoomX(20), zoomY(200))
    }

    const drawNewPoint = (context) => {
        if (mouse.buttonL === true && currentClass !== null && currentPoint === null) {
            const x = mouse.realX
            const y = mouse.realY

            setPointStyles(context, true)
            drawPoint(context, x, y, true)
            drawClassLabel(context, x, y, currentClass)

            setPointCoordinates(x, y)
        }
    }

    const drawExistingPoints = (context) => {
        const currentPoints = bboxes[currentImage.name]

        for (let className in currentPoints) {
            currentPoints[className].forEach(point => {
                drawPoint(context, point.x, point.y, point.marked)
                drawClassLabel(context, point.x, point.y, point.class)
                if (point.marked === true) {
                    setPointCoordinates(point.x, point.y)
                }
            })
        }
    }

    const drawPoint = (context, x, y, marked) => {
        context.beginPath()
        context.arc(zoomX(x), zoomY(y), zoom(pointRadius), 0, 2 * Math.PI, false)
        context.fillStyle = marked ? markedBackgroundColor : backgroundColor
        context.fill()
        context.lineWidth = 1
        context.strokeStyle = marked ? markedBorderColor : borderColor
        context.stroke()
    }

    const drawClassLabel = (context, x, y, className) => {
        context.fillStyle = fontColor
        context.font = `${zoom(fontBaseSize)}px Arial`
        context.fillText(className, zoomX(x + pointRadius), zoomY(y - pointRadius))
    }

    const drawCross = (context) => {
        if (drawGuidelines === true) {
            context.setLineDash([5])

            context.beginPath()
            context.moveTo(zoomX(mouse.realX), zoomY(0))
            context.lineTo(zoomX(mouse.realX), zoomY(currentImage.height))
            context.stroke()

            context.beginPath()
            context.moveTo(zoomX(0), zoomY(mouse.realY))
            context.lineTo(zoomX(currentImage.width), zoomY(mouse.realY))
            context.stroke()
        }
    }

    const setPointStyles = (context, marked) => {
        context.setLineDash([])

        if (marked === false) {
            context.strokeStyle = borderColor
            context.fillStyle = backgroundColor
        } else {
            context.strokeStyle = markedBorderColor
            context.fillStyle = markedBackgroundColor
        }
    }

    const setPointCoordinates = (x, y) => {
        document.getElementById("bboxInformation").innerHTML = `(${x}, ${y})`
    }

    const setFontStyles = (context, marked) => {
        if (marked === false) {
            context.fillStyle = fontColor
        } else {
            context.fillStyle = markedFontColor
        }

        context.font = context.font.replace(/\d+px/, `${zoom(fontBaseSize)}px`)
    }

    const listenCanvasMouse = () => {
        canvas.element.addEventListener("wheel", trackWheel, {passive: false})
        canvas.element.addEventListener("mousemove", trackPointer)
        canvas.element.addEventListener("mousedown", trackPointer)
        canvas.element.addEventListener("mouseup", trackPointer)
        canvas.element.addEventListener("mouseout", trackPointer)
    }

    const trackWheel = (event) => {
        if (event.deltaY < 0) {
            scale = Math.min(maxZoom, scale * scrollSpeed)
        } else {
            scale = Math.max(minZoom, scale * (1 / scrollSpeed))
        }

        canvasX = mouse.realX
        canvasY = mouse.realY
        screenX = mouse.x
        screenY = mouse.y

        mouse.realX = zoomXInv(mouse.x)
        mouse.realY = zoomYInv(mouse.y)

        event.preventDefault()
    }

    const trackPointer = (event) => {
        mouse.bounds = canvas.element.getBoundingClientRect()
        mouse.x = event.clientX - mouse.bounds.left
        mouse.y = event.clientY - mouse.bounds.top

        const xx = mouse.realX
        const yy = mouse.realY

        mouse.realX = zoomXInv(mouse.x)
        mouse.realY = zoomYInv(mouse.y)

        if (event.type === "mousedown") {
            mouse.startRealX = mouse.realX
            mouse.startRealY = mouse.realY

            if (event.which === 3) {
                mouse.buttonR = true
            } else if (event.which === 1) {
                mouse.buttonL = true
                selectPoint()
            }
        } else if (event.type === "mouseup" || event.type === "mouseout") {
            if (mouse.buttonL === true && currentImage !== null && currentClass !== null) {
                if (currentPoint === null) {
                    storeNewPoint()
                } else {
                    updatePointAfterMove()
                }
            }

            mouse.buttonR = false
            mouse.buttonL = false
        }

        movePoint()
        changeCursorByLocation()

        panImage(xx, yy)
    }

    const selectPoint = () => {
        let selected = false
        const currentPoints = bboxes[currentImage.name]

        for (let className in currentPoints) {
            currentPoints[className].forEach((point, index) => {
                const dx = mouse.realX - point.x
                const dy = mouse.realY - point.y
                const distance = Math.sqrt(dx * dx + dy * dy)

                if (distance < pointRadius) {
                    currentPoint = {
                        point: point,
                        index: index,
                        className: className,
                        originalX: point.x,
                        originalY: point.y,
                        moving: false
                    }
                    point.marked = true
                    selected = true
                } else {
                    point.marked = false
                }
            })
        }

        if (!selected) {
            currentPoint = null
        }
    }

    const storeNewPoint = () => {
        const point = {
            x: mouse.realX,
            y: mouse.realY,
            marked: true,
            class: currentClass
        }

        if (typeof bboxes[currentImage.name] === "undefined") {
            bboxes[currentImage.name] = {}
        }

        if (typeof bboxes[currentImage.name][currentClass] === "undefined") {
            bboxes[currentImage.name][currentClass] = []
        }

        bboxes[currentImage.name][currentClass].push(point)

        currentPoint = {
            point: point,
            index: bboxes[currentImage.name][currentClass].length - 1,
            originalX: point.x,
            originalY: point.y,
            moving: false
        }
    }

    const updatePointAfterMove = () => {
        currentPoint.point.marked = true
        currentPoint.originalX = currentPoint.point.x
        currentPoint.originalY = currentPoint.point.y
    }

    const movePoint = () => {
        if (mouse.buttonL === true && currentPoint !== null) {
            currentPoint.point.x = currentPoint.originalX + (mouse.realX - mouse.startRealX)
            currentPoint.point.y = currentPoint.originalY + (mouse.realY - mouse.startRealY)
        }
    }

    const changeCursorByLocation = () => {
        if (currentImage !== null) {
            const currentPoints = bboxes[currentImage.name]

            for (let className in currentPoints) {
                for (let i = 0; i < currentPoints[className].length; i++) {
                    const point = currentPoints[className][i]

                    const dx = mouse.realX - point.x
                    const dy = mouse.realY - point.y
                    const distance = Math.sqrt(dx * dx + dy * dy)

                    if (distance < pointRadius) {
                        document.body.style.cursor = "pointer"
                        return
                    }
                }
            }
        }

        document.body.style.cursor = "default"
    }

    const panImage= (xx, yy) => {
        if (mouse.buttonR === true) {
            canvasX -= mouse.realX - xx
            canvasY -= mouse.realY - yy

            mouse.realX = zoomXInv(mouse.x)
            mouse.realY = zoomYInv(mouse.y)
        }
    }

    const zoom = (number) => {
        return Math.floor(number * scale)
    }

    const zoomX = (number) => {
        return Math.floor((number - canvasX) * scale + screenX)
    }

    const zoomY = (number) => {
        return Math.floor((number - canvasY) * scale + screenY)
    }

    const zoomXInv = (number) => {
        return Math.floor((number - screenX) * (1 / scale) + canvasX)
    }

    const zoomYInv = (number) => {
        return Math.floor((number - screenY) * (1 / scale) + canvasY)
    }

    const listenImageLoad = () => {
        document.getElementById("images").addEventListener("change", (event) => {
            const files = event.target.files

            if (files.length > 0) {
                resetImageList()

                document.body.style.cursor = "wait"

                const file = files[0]
                const nameParts = file.name.split(".")
                if (extensions.indexOf(nameParts[nameParts.length - 1]) !== -1) {
                    images[file.name] = { meta: file, index: 0 }

                    const reader = new FileReader()
                    reader.addEventListener("load", () => {
                        const imageObject = new Image()
                        imageObject.addEventListener("load", (event) => {
                            images[file.name].width = event.target.width
                            images[file.name].height = event.target.height
                            document.body.style.cursor = "default"
                            setCurrentImage(images[file.name])
                        })
                        imageObject.src = reader.result
                    })
                    reader.readAsDataURL(file)
                }
            }
        })
    }

    const resetImageList = () => {
        images = {}
        bboxes = {}
        currentImage = null
    }

    const setCurrentImage = (image) => {
        if (resetCanvasOnChange === true) {
            resetCanvasPlacement()
        }

        if (fittedZoom === true) {
            fitZoom(image)
        }

        const reader = new FileReader()

        reader.addEventListener("load", () => {
            const dataUrl = reader.result
            const imageObject = new Image()

            imageObject.addEventListener("load", () => {
                currentImage = {
                    name: image.meta.name,
                    object: imageObject,
                    width: image.width,
                    height: image.height
                }
                restorePointsForImage(image.meta.name)
            })

            imageObject.src = dataUrl

            document.getElementById("imageInformation")
                .innerHTML = `${image.width}x${image.height}, ${formatBytes(image.meta.size)}`
        })

        reader.readAsDataURL(image.meta)

        if (currentPoint !== null) {
            currentPoint.point.marked = false // We unmark via reference
            currentPoint = null // and then we delete
        }
    }

    const fitZoom = (image) => {
        if (image.width > image.height) {
            scale = canvas.width / image.width
        } else {
            scale = canvas.height / image.height
        }
    }

    const formatBytes = (bytes, decimals) => {
        if (bytes === 0) {
            return "0 Bytes"
        }

        const k = 1024
        const dm = decimals || 2
        const sizes = ["Bytes", "KB", "MB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
    }

    const listenClassInput = () => {
        const addClassButton = document.getElementById("addClassButton")
        const classInput = document.getElementById("classInput")

        addClassButton.addEventListener("click", () => {
            const className = classInput.value.trim()
            if (className && !classes[className]) {
                classes[className] = Object.keys(classes).length
                const option = document.createElement("option")
                option.value = classes[className]
                option.innerHTML = className
                document.getElementById("classList").appendChild(option)
                classInput.value = ''
            }
        })
    }

    const listenClassSelect = () => {
        const classList = document.getElementById("classList")

        classList.addEventListener("change", () => {
            classListIndex = classList.selectedIndex

            setCurrentClass()
        })
    }

    const setCurrentClass = () => {
        const classList = document.getElementById("classList")

        currentClass = classList.options[classList.selectedIndex].text

        if (currentPoint !== null && currentPoint.point) {
            currentPoint.point.marked = false // We unmark via reference
            currentPoint = null // and then we delete
        }
    }

    const listenBboxLoad = () => {
        const bboxesElement = document.getElementById("bboxes")

        bboxesElement.addEventListener("click", () => {
            bboxesElement.value = null
        })

        bboxesElement.addEventListener("change", (event) => {
            const files = event.target.files

            if (files.length > 0) {
                resetBboxes()

                for (let i = 0; i < files.length; i++) {
                    const reader = new FileReader()

                    const extension = files[i].name.split(".").pop()

                    reader.addEventListener("load", () => {
                        if (extension === "json") {
                            storeBbox(files[i].name, reader.result)
                        }
                    })

                    if (extension === "json") {
                        reader.readAsText(files[i])
                    } else {
                        reader.readAsArrayBuffer(event.target.files[i])
                    }
                }
            }
        })
    }

    const resetBboxes = () => {
        bboxes = {}
    }

    // const storeBbox = (filename, text) => {
    //     const json = JSON.parse(text)

    //     const imageName = json.image

    //     if (typeof images[imageName] !== "undefined") {
    //         if (typeof bboxes[imageName] === "undefined") {
    //             bboxes[imageName] = {}
    //         }

    //         json.annotations.forEach(annotation => {
    //             const className = annotation.class
    //             const x = annotation.x * images[imageName].width
    //             const y = annotation.y * images[imageName].height

    //             if (typeof bboxes[imageName][className] === "undefined") {
    //                 bboxes[imageName][className] = []
    //             }

    //             bboxes[imageName][className].push({
    //                 x: x,
    //                 y: y,
    //                 marked: false,
    //                 class: className
    //             })
    //         })
    //     }
    // }

    const storeBbox = (filename, text) => {
        const json = JSON.parse(text)
    
        const imageName = json.image
    
        if (typeof images[imageName] !== "undefined") {
            if (typeof bboxes[imageName] === "undefined") {
                bboxes[imageName] = {}
            }
    
            json.annotations.forEach(annotation => {
                const className = annotation.class
                const x = annotation.x * images[imageName].width
                const y = annotation.y * images[imageName].height
    
                // Add class to class list if not already present
                if (!classes[className]) {
                    classes[className] = Object.keys(classes).length
                    const option = document.createElement("option")
                    option.value = classes[className]
                    option.innerHTML = className
                    document.getElementById("classList").appendChild(option)
                }
    
                if (typeof bboxes[imageName][className] === "undefined") {
                    bboxes[imageName][className] = []
                }
    
                bboxes[imageName][className].push({
                    x: x,
                    y: y,
                    marked: false,
                    class: className
                })
            })
        }
    }
    

    const restorePointsForImage = (imageName) => {
        if (bboxes[imageName]) {
            const currentPoints = bboxes[imageName]

            for (let className in currentPoints) {
                currentPoints[className].forEach(point => {
                    point.marked = false
                })
            }

            currentPoint = null
        }
    }

    const listenBboxSave = () => {
        document.getElementById("saveBboxes").addEventListener("click", () => {
            const zip = new JSZip()

            for (let imageName in bboxes) {
                const image = images[imageName]
                const annotations = []

                for (let className in bboxes[imageName]) {
                    for (let i = 0; i < bboxes[imageName][className].length; i++) {
                        const point = bboxes[imageName][className][i]
                        annotations.push({
                            class: className,
                            class_id: classes[className],
                            x: point.x / image.width,
                            y: point.y / image.height
                        })
                    }
                }

                const jsonContent = JSON.stringify({
                    image: imageName,
                    annotations: annotations
                })

                const jsonFileName = imageName.split('.').slice(0, -1).join('.') + '.json'
                zip.file(jsonFileName, jsonContent)
            }

            zip.generateAsync({ type: "blob" }).then((blob) => {
                saveAs(blob, "annotations.zip")
            })
        })
    }

    const listenKeyboard = () => {
        const classList = document.getElementById("classList")

        document.addEventListener("keydown", (event) => {
            const key = event.keyCode || event.charCode

            if (key === 46 || (key === 8 && (event.metaKey || event.ctrlKey))) {
                if (currentPoint !== null) {
                    bboxes[currentImage.name][currentPoint.className].splice(currentPoint.index, 1)
                    currentPoint = null

                    document.body.style.cursor = "default"
                }

                event.preventDefault()
            }

            if (key === 38) {
                if (classList.length > 1) {
                    classList.options[classListIndex].selected = false

                    if (classListIndex === 0) {
                        classListIndex = classList.length - 1
                    } else {
                        classListIndex--
                    }

                    classList.options[classListIndex].selected = true
                    classList.selectedIndex = classListIndex

                    setCurrentClass()
                }

                event.preventDefault()
            }

            if (key === 40) {
                if (classList.length > 1) {
                    classList.options[classListIndex].selected = false

                    if (classListIndex === classList.length - 1) {
                        classListIndex = 0
                    } else {
                        classListIndex++
                    }

                    classList.options[classListIndex].selected = true
                    classList.selectedIndex = classListIndex

                    setCurrentClass()
                }

                event.preventDefault()
            }
        })
    }

    const resetCanvasPlacement = () => {
        scale = defaultScale
        canvasX = 0
        canvasY = 0
        screenX = 0
        screenY = 0

        mouse.x = 0
        mouse.y = 0
        mouse.realX = 0
        mouse.realY = 0
        mouse.buttonL = 0
        mouse.buttonR = 0
        mouse.startRealX = 0
        mouse.startRealY = 0
    }
})()

