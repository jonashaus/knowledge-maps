import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
    };
  }
}

/** A highlighted box that can hold any blocks, like Notion's callout. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
    };
  },
});
