export function createUI(assetMap) {
    const Screen2D = new pc.Entity("UIPanel");
    Screen2D.addComponent("screen", {
        screenSpace: true,
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        referenceResolution: new pc.Vec2(720, 1280),
    });

    const textUnavailable = new pc.Entity("txtWebXROff");
    textUnavailable.enabled = false;
    textUnavailable.addComponent("element", {
        type: "text",
        text: "WebXR is not supported on your device",
        fontSize: 24,
        fontAsset: assetMap.Font.id,
        pivot: new pc.Vec2(0.5, 0.5),
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        alignment: new pc.Vec2(0.5, 0.5),
        color: new pc.Color(0.6, 0.6, 0.6)
    });
    textUnavailable.setLocalPosition(0, -20, 0);

    const textTutorial2D = new pc.Entity("textTutorial");
    textTutorial2D.enabled = false;
    textTutorial2D.addComponent("element", {
        type: "text",
        text: "Point the circle at the center of\n the room and tap the screen",
        anchor: new pc.Vec4(0.5, 1, 0.5, 1),
        pivot: new pc.Vec2(0.5, 0.5),
        width: 200,
        height: 140,
        fontAsset: assetMap.Font.id,
        fontSize: 42,
        lineHeight: 46,
        alignment: new pc.Vec2(0.5, 0.5),
        wrapLines: true,
        maxLines: 2,
        color: new pc.Color(1, 1, 1)
    });
    textTutorial2D.setLocalPosition(0, -200, 0);

    Screen2D.addChild(textUnavailable);
    Screen2D.addChild(textTutorial2D);

    // ------------------------------------------------3D Panel---------------------------------------
    const Screen3D = new pc.Entity('3D Screen');
    Screen3D.setLocalScale(0.003, 0.003, 0.003);
    Screen3D.setLocalPosition(0, 0, 0);
    Screen3D.setLocalEulerAngles(-30, 0, 0);

    Screen3D.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        screenSpace: false,
        priority: 10
    });

    const textTutorial3D = new pc.Entity("textTutorial");
    textTutorial3D.enabled = true;
    textTutorial3D.addComponent("element", {
        type: "text",
        text: "Point the circle at the center of\n the room and tap the screen",
        anchor: [0.5, 0.5, 0.5, 0.5],
        pivot: [0.5, 0.5],
        width: 200,
        height: 140,
        fontAsset: assetMap.Font.id,
        fontSize: 32,
        lineHeight: 46,
        alignment: new pc.Vec2(0.5, 0.5),
        wrapLines: true,
        maxLines: 2,
        color: new pc.Color(1, 1, 1),
        layers: [4]
    });
    textTutorial3D.setLocalPosition(0, 360, 0);
    Screen3D.addChild(textTutorial3D);

    Screen3D.enabled = false;

    return { Screen2D, textUnavailable, textTutorial2D, Screen3D, textTutorial3D};
}